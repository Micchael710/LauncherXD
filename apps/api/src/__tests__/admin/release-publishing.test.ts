import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReleasePublishingService } from '../../services/release-publishing-service';
import { getExpectedAssetName, getCanonicalTag } from '../../utils/validation';

describe('Validation Utilities - Phase 6', () => {
  it('canonical tag generation', () => {
    expect(getCanonicalTag('launcher', 'stable', '1.0.0')).toBe('launcher-stable-v1.0.0');
    expect(getCanonicalTag('launcher', 'beta', '1.1.0-beta.1')).toBe('launcher-beta-v1.1.0-beta.1');
    expect(getCanonicalTag('modpack', 'stable', '1.0.0')).toBe('modpack-stable-v1.0.0');
    expect(getCanonicalTag('modpack', 'beta', '1.1.0-beta.1')).toBe('modpack-beta-v1.1.0-beta.1');
  });

  it('asset naming is deterministic and safe', async () => {
    const name1 = await getExpectedAssetName('mods/create.jar', 'create-1.0.jar');
    const name2 = await getExpectedAssetName('mods/create.jar', 'create-1.0.jar');
    const name3 = await getExpectedAssetName('config/create.toml', 'create-1.0.jar');

    expect(name1).toBe(name2);
    expect(name1).not.toBe(name3);

    // No backslashes or colons
    const name4 = await getExpectedAssetName('test\\path:file', 'file:name.jar');
    expect(name4).not.toMatch(/[\\:]/);
    expect(name4).toMatch(/^lx-[0-9a-f]{64}-/);

    const part1 = await getExpectedAssetName('downloads/game.part01', 'game.zip');
    const part2 = await getExpectedAssetName('downloads/game.part02', 'game.zip');
    expect(part1).not.toBe(part2);
  });
});

describe('ReleasePublishingService', () => {
  let provider: any;
  let repository: any;
  let service: ReleasePublishingService;

  beforeEach(() => {
    provider = {
      getRelease: vi.fn(),
      createDraftRelease: vi.fn(),
      updateRelease: vi.fn(),
      listAssets: vi.fn(),
      uploadGeneratedAsset: vi.fn(),
      deleteGeneratedManifest: vi.fn()
    };

    repository = {
      getReleaseById: vi.fn(),
      getReleaseFiles: vi.fn(),
      updateRelease: vi.fn(),
      updateReleaseFile: vi.fn()
    };

    service = new ReleasePublishingService(provider, repository);
  });

  it('prepare: creates draft if missing', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', version: '1.0.0', channel: 'stable', release_type: 'launcher' });
    repository.getReleaseFiles.mockResolvedValue([]);
    provider.getRelease.mockResolvedValue(null);
    provider.createDraftRelease.mockResolvedValue({ id: 'gh-1', draft: true });

    const res = await service.prepare('rel-1');
    expect(provider.createDraftRelease).toHaveBeenCalledWith('launcher-stable-v1.0.0', '1.0.0 (stable)', '', false);
    expect(res.github_tag).toBe('launcher-stable-v1.0.0');
    expect(repository.updateRelease).toHaveBeenCalledWith('rel-1', { github_tag: 'launcher-stable-v1.0.0', github_release_id: 'gh-1' });
  });

  it('status: digest validation and missing assets', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', github_tag: 'tag-1' });
    provider.getRelease.mockResolvedValue({ id: 'gh-1' });

    const expectedName = await getExpectedAssetName('file1', 'file1');
    repository.getReleaseFiles.mockResolvedValue([
      { id: 'f1', path: 'file1', filename: 'file1', size: 100, sha256: 'AAAA' }
    ]);

    // Test different GitHub asset scenarios
    provider.listAssets.mockResolvedValue([
      { name: expectedName, state: 'uploaded', size: 100, digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } // digest mismatch
    ]);

    let res = await service.status('rel-1');
    expect(res.assetStatuses['f1'].status).toBe('digest_mismatch');

    provider.listAssets.mockResolvedValue([
      { name: expectedName, state: 'uploaded', size: 100, digest: 'sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } // ready (case insensitive)
    ]);
    repository.getReleaseFiles.mockResolvedValue([
      { id: 'f1', path: 'file1', filename: 'file1', size: 100, sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
    ]);

    res = await service.status('rel-1');
    expect(res.assetStatuses['f1'].status).toBe('ready');

    provider.listAssets.mockResolvedValue([
      { name: expectedName, state: 'uploaded', size: 99, digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } // size mismatch
    ]);
    res = await service.status('rel-1');
    expect(res.assetStatuses['f1'].status).toBe('size_mismatch');

    provider.listAssets.mockResolvedValue([
      { name: expectedName, state: 'new' } // not uploaded
    ]);
    res = await service.status('rel-1');
    expect(res.assetStatuses['f1'].status).toBe('state_invalid');

    provider.listAssets.mockResolvedValue([
      { name: expectedName, state: 'uploaded', size: 100, digest: 'foo' } // invalid algorithm
    ]);
    res = await service.status('rel-1');
    expect(res.assetStatuses['f1'].status).toBe('digest_invalid');
  });

  it('publish: enforces order validate -> verify assets -> sync -> manifest -> gh publish -> d1 publish', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', version: '1.0.0', github_tag: 'tag-1' });
    provider.getRelease.mockResolvedValue({ id: 'gh-1', draft: true });

    const expectedName = await getExpectedAssetName('file1', 'file1');
    repository.getReleaseFiles.mockResolvedValue([
      { id: 'f1', path: 'file1', filename: 'file1', size: 100, sha256: 'a'.repeat(64), operation: 'add' }
    ]);
    provider.listAssets.mockResolvedValue([
      { name: expectedName, state: 'uploaded', size: 100, digest: 'sha256:' + 'a'.repeat(64), downloadUrl: 'url1', id: 'a1' }
    ]);

    const callOrder: string[] = [];
    repository.updateReleaseFile.mockImplementation(() => callOrder.push('sync'));
    provider.uploadGeneratedAsset.mockImplementation(() => callOrder.push('manifest'));
    provider.updateRelease.mockImplementation(() => callOrder.push('gh_publish'));
    repository.updateRelease.mockImplementation(() => callOrder.push('d1_publish'));

    await service.publish('rel-1', '1.0.0');

    expect(callOrder).toEqual(['sync', 'manifest', 'gh_publish', 'd1_publish']);
  });

  it('publish: fails and leaves D1 as draft if GitHub fails', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', version: '1.0.0', github_tag: 'tag-1' });
    provider.getRelease.mockResolvedValue({ id: 'gh-1', draft: true });

    repository.getReleaseFiles.mockResolvedValue([]);
    provider.listAssets.mockResolvedValue([]);

    provider.updateRelease.mockRejectedValue(new Error('github_unavailable'));

    await expect(service.publish('rel-1', '1.0.0')).rejects.toThrow('github_unavailable');

    // D1 publish should not be called
    expect(repository.updateRelease).not.toHaveBeenCalled();
  });

  it('publish: reconciliation when GitHub is already published but D1 is draft', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', version: '1.0.0', github_tag: 'tag-1' });
    // Simulate GitHub already published!
    provider.getRelease.mockResolvedValue({ id: 'gh-1', draft: false });

    repository.getReleaseFiles.mockResolvedValue([]);
    provider.listAssets.mockResolvedValue([]);

    const res = await service.publish('rel-1', '1.0.0');
    expect(res.status).toBe('published');

    // updateRelease for GitHub should NOT be called since draft=false
    expect(provider.updateRelease).not.toHaveBeenCalled();
    // It should complete the D1 state since GitHub was already published.
    expect(repository.updateRelease).toHaveBeenCalledWith('rel-1', expect.objectContaining({ status: 'published' }));
  });

  it('publish: idempotent if D1 already published', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'published', version: '1.0.0' });
    const res = await service.publish('rel-1', '1.0.0');
    expect(res.status).toBe('already_published');
  });

  it('publish: requires correct confirm_version', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', version: '1.0.0' });
    await expect(service.publish('rel-1', '2.0.0')).rejects.toThrow('invalid_confirm_version');
  });

  it('manifest: generated identically for identical inputs, idempotent upload', async () => {
    repository.getReleaseById.mockResolvedValue({ status: 'draft', version: '1.0.0', channel: 'stable', release_type: 'launcher', total_size: 200, github_tag: 'tag-1' });
    provider.getRelease.mockResolvedValue({ id: 'gh-1', draft: true });

    const expectedNameA = await getExpectedAssetName('a', 'a');
    const expectedNameB = await getExpectedAssetName('b', 'b');

    provider.listAssets.mockResolvedValue([
      { name: expectedNameA, state: 'uploaded', size: 100, digest: 'sha256:' + 'b'.repeat(64) },
      { name: expectedNameB, state: 'uploaded', size: 100, digest: 'sha256:' + 'c'.repeat(64) }
    ]);

    repository.getReleaseFiles.mockResolvedValue([
      { id: 'f2', logical_path: 'b', path: 'b', filename: 'b', size: 100, sha256: 'c'.repeat(64), operation: 'add', download_url: 'u2' },
      { id: 'f1', logical_path: 'a', path: 'a', filename: 'a', size: 100, sha256: 'b'.repeat(64), operation: 'add', download_url: 'u1' }
    ]);

    let uploadedManifest1: string;
    provider.uploadGeneratedAsset.mockImplementation(async (id: any, name: any, content: any) => {
      uploadedManifest1 = content;
    });

    await service.publish('rel-1', '1.0.0');

    expect(uploadedManifest1!).toBeDefined();

    // Now simulate idempotency: listAssets returns the manifest with the exact same digest
    const enc = new TextEncoder();
    const manifestHashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(uploadedManifest1!));
    const manifestHashHex = Array.from(new Uint8Array(manifestHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    provider.listAssets.mockResolvedValue([
      { name: expectedNameA, state: 'uploaded', size: 100, digest: 'sha256:' + 'b'.repeat(64) },
      { name: expectedNameB, state: 'uploaded', size: 100, digest: 'sha256:' + 'c'.repeat(64) },
      { name: 'launcherxd-manifest.json', state: 'uploaded', size: 100, digest: 'sha256:' + manifestHashHex, id: 'm-1' }
    ]);

    provider.uploadGeneratedAsset.mockClear();
    provider.deleteGeneratedManifest.mockClear();

    // Call publish again
    await service.publish('rel-1', '1.0.0');

    // Should NOT delete or upload because digest matches exactly
    expect(provider.deleteGeneratedManifest).not.toHaveBeenCalled();
    expect(provider.uploadGeneratedAsset).not.toHaveBeenCalled();

    // Simulate mismatch digest
    provider.listAssets.mockResolvedValue([
      { name: expectedNameA, state: 'uploaded', size: 100, digest: 'sha256:' + 'b'.repeat(64) },
      { name: expectedNameB, state: 'uploaded', size: 100, digest: 'sha256:' + 'c'.repeat(64) },
      { name: 'launcherxd-manifest.json', state: 'uploaded', size: 100, digest: 'sha256:' + 'd'.repeat(64), id: 'm-1' }
    ]);

    await service.publish('rel-1', '1.0.0');
    expect(provider.deleteGeneratedManifest).toHaveBeenCalledWith('gh-1', 'm-1');
    expect(provider.uploadGeneratedAsset).toHaveBeenCalled();
  });
});
