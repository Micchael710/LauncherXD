import { ArtifactPublishingProvider } from './providers/artifact-storage-provider';
import { ReleaseRepository } from '../repositories/release-repository';
import { validateReleaseReady, getCanonicalTag, getExpectedAssetName } from '../utils/validation';
import { Release, ReleaseFile } from '../types';

export class ReleasePublishingService {
  constructor(
    private readonly provider: ArtifactPublishingProvider,
    private readonly repository: ReleaseRepository
  ) {}

  async prepare(releaseId: string): Promise<any> {
    const release = await this.repository.getReleaseById(releaseId);
    if (!release) throw new Error('not_found');
    if (release.status !== 'draft') throw new Error('not_draft');

    const files = await this.repository.getReleaseFiles(releaseId);
    const issues = validateReleaseReady(release, files);
    if (issues.length > 0) {
      throw new Error('validation_failed');
    }

    const tag = getCanonicalTag(release.release_type, release.channel, release.version);
    let githubRelease = await this.provider.getRelease(tag);
    if (!githubRelease) {
      const isBeta = release.channel === 'beta';
      githubRelease = await this.provider.createDraftRelease(tag, release.version + ' (' + release.channel + ')', release.release_notes || '', isBeta);
    } else {
      if (!githubRelease.draft) throw new Error('conflict_already_published');
    }

    await this.repository.updateRelease(releaseId, {
      github_tag: tag,
      github_release_id: githubRelease.id
    });

    const expectedAssets = await Promise.all(files.map(async f => ({
      fileId: f.id,
      name: await getExpectedAssetName(f.path, f.path.split('/').pop() || f.filename)
    })));

    return {
      github_tag: tag,
      github_release_id: githubRelease.id,
      expectedAssets
    };
  }

  async status(releaseId: string): Promise<any> {
    const release = await this.repository.getReleaseById(releaseId);
    if (!release) throw new Error('not_found');
    if (!release.github_tag) throw new Error('not_prepared');

    const githubRelease = await this.provider.getRelease(release.github_tag);
    if (!githubRelease) throw new Error('not_prepared');

    const assets = await this.provider.listAssets(release.github_tag);
    const files = await this.repository.getReleaseFiles(releaseId);

    const assetStatuses: Record<string, any> = {};
    const unexpectedAssets = [];

    const expectedNames = new Map();
    for (const f of files) {
      const expectedName = await getExpectedAssetName(f.path, f.path.split('/').pop() || f.filename);
      expectedNames.set(expectedName, f);

      if (f.operation === 'delete') {
        assetStatuses[f.id] = { status: 'ready', operation: 'delete' };
        continue;
      }

      const asset = assets.find(a => a.name === expectedName);
      if (!asset) {
        assetStatuses[f.id] = { status: 'asset_not_uploaded' };
      } else if (asset.state !== 'uploaded') {
        assetStatuses[f.id] = { status: 'state_invalid', state: asset.state };
      } else if (asset.size !== f.size) {
        assetStatuses[f.id] = { status: 'size_mismatch' };
      } else if (!asset.digest) {
        assetStatuses[f.id] = { status: 'digest_missing' };
      } else if (typeof asset.digest !== 'string' || !/^sha256:[A-Fa-f0-9]{64}$/i.test(asset.digest)) {
         assetStatuses[f.id] = { status: 'digest_invalid' };
      } else {
        const ghDigest = asset.digest.replace(/^sha256:/i, '').toLowerCase();
        const d1Digest = f.sha256?.toLowerCase();
        if (ghDigest !== d1Digest) {
          assetStatuses[f.id] = { status: 'digest_mismatch' };
        } else {
          assetStatuses[f.id] = { status: 'ready', github_asset_id: asset.id, download_url: asset.downloadUrl };
        }
      }
    }

    for (const a of assets) {
      if (a.name === 'launcherxd-manifest.json') continue;
      if (!expectedNames.has(a.name)) {
        unexpectedAssets.push({ id: a.id, name: a.name });
      }
    }

    const allReady = Object.values(assetStatuses).every((s: any) => s.status === 'ready');

    return {
      status: allReady ? 'ready' : 'syncing',
      assetStatuses,
      unexpectedAssets
    };
  }

  async publish(releaseId: string, confirmVersion: string): Promise<any> {
    const release = await this.repository.getReleaseById(releaseId);
    if (!release) throw new Error('not_found');
    if (release.version !== confirmVersion) throw new Error('invalid_confirm_version');

    if (release.status === 'published') {
      return { status: 'already_published' };
    }
    if (!release.github_tag) throw new Error('not_prepared');

    let githubRelease = await this.provider.getRelease(release.github_tag);
    if (!githubRelease) throw new Error('not_prepared');

    const statusReport = await this.status(releaseId);
    if (statusReport.status !== 'ready') throw new Error('assets_missing');

    // Update D1 github_asset_id and download_url
    for (const [fileId, stat] of Object.entries(statusReport.assetStatuses)) {
      const s = stat as any;
      if (s.github_asset_id && s.download_url) {
        await this.repository.updateReleaseFile(fileId, releaseId, {
          github_asset_id: s.github_asset_id,
          download_url: s.download_url
        });
      }
    }

    const files = await this.repository.getReleaseFiles(releaseId);

    // Sort files deterministically: logical_path ASC, part_index ASC (null=0), path ASC
    files.sort((a, b) => {
      if (a.logical_path < b.logical_path) return -1;
      if (a.logical_path > b.logical_path) return 1;
      const aIdx = a.part_index ?? 0;
      const bIdx = b.part_index ?? 0;
      if (aIdx < bIdx) return -1;
      if (aIdx > bIdx) return 1;
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;
      return 0;
    });

    const manifest = {
      schemaVersion: 1,
      version: release.version,
      channel: release.channel,
      type: release.release_type,
      totalSize: release.total_size,
      files: files.map(f => ({
        path: f.path,
        logicalPath: f.logical_path,
        operation: f.operation,
        size: f.size,
        sha256: f.sha256,
        downloadUrl: f.download_url || (statusReport.assetStatuses[f.id] as any)?.download_url,
        partIndex: f.part_index,
        partCount: f.part_count,
        finalSha256: f.final_sha256
      }))
    };

    const manifestContent = JSON.stringify(manifest);

    // Calculate sha256 of manifest for idempotency
    const enc = new TextEncoder();
    const manifestHashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(manifestContent));
    const manifestHashArray = Array.from(new Uint8Array(manifestHashBuffer));
    const manifestHashHex = manifestHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const expectedManifestDigest = 'sha256:' + manifestHashHex;

    const assets = await this.provider.listAssets(release.github_tag);
    const existingManifest = assets.find(a => a.name === 'launcherxd-manifest.json');
    if (existingManifest) {
      if (existingManifest.digest === expectedManifestDigest) {
        // Do nothing, idempotent
      } else {
        await this.provider.deleteGeneratedManifest(githubRelease.id, existingManifest.id);
        await this.provider.uploadGeneratedAsset(githubRelease.id, 'launcherxd-manifest.json', manifestContent, 'application/json');
      }
    } else {
      await this.provider.uploadGeneratedAsset(githubRelease.id, 'launcherxd-manifest.json', manifestContent, 'application/json');
    }

    if (githubRelease.draft) {
      // Publish release (draft = false, make_latest = false)
      await this.provider.updateRelease(githubRelease.id, false);
    }

    // Update D1
    await this.repository.updateRelease(releaseId, { status: 'published', published_at: new Date().toISOString() });

    return { status: 'published' };
  }
}
