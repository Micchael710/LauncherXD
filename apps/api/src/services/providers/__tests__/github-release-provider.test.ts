import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitHubReleaseProvider } from '../github-release-provider';

// Mocks the global fetch function

const originalFetch = globalThis.fetch;

describe('GitHubReleaseProvider', () => {
  const config = {
    owner: 'testowner',
    repo: 'testrepo',
    token: 'testtoken'
  };

  let provider: GitHubReleaseProvider;

  beforeEach(() => {
    provider = new GitHubReleaseProvider(config);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should check connection successfully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const isConnected = await provider.checkConnection();
    expect(isConnected).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.github.com/repos/testowner/testrepo', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer testtoken'
      })
    }));
  });

  it('should use correct LauncherXD-Releases repository URL derived from config', async () => {
    const customConfig = {
      owner: 'Micchael710',
      repo: 'LauncherXD-Releases',
      token: 'testtoken'
    };
    const customProvider = new GitHubReleaseProvider(customConfig);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    await customProvider.checkConnection();

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.github.com/repos/Micchael710/LauncherXD-Releases', expect.any(Object));
  });

  it('should throw controlled error on 401 unauthorized', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } as any);

    await expect(provider.checkConnection()).rejects.toThrow('github_unauthorized');
  });

  it('should throw controlled error on 403 forbidden', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    } as any);

    await expect(provider.checkConnection()).rejects.toThrow('github_forbidden');
  });

  it('should throw github_not_found on repo not found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    await expect(provider.checkConnection()).rejects.toThrow('github_not_found');
  });

  it('should throw github_unavailable on 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    await expect(provider.checkConnection()).rejects.toThrow('github_unavailable');
  });

  it('should retrieve a release successfully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 12345,
        tag_name: 'v1.0.0',
        name: 'Release 1.0.0',
        draft: false,
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z'
      })
    } as any);

    const release = await provider.getRelease('v1.0.0');
    expect(release).not.toBeNull();
    expect(release?.id).toBe('12345');
    expect(release?.tag).toBe('v1.0.0');
  });

  it('should return null if release is not found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const release = await provider.getRelease('v1.0.0');
    expect(release).toBeNull();
  });

  it('should list assets successfully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assets: [
          {
            id: 111,
            name: 'asset1.zip',
            size: 1024,
            browser_download_url: 'https://github.com/test/download/asset1.zip',
            content_type: 'application/zip'
          }
        ]
      })
    } as any);

    const assets = await provider.listAssets('v1.0.0');
    expect(assets.length).toBe(1);
    expect(assets[0].name).toBe('asset1.zip');
    expect(assets[0].size).toBe(1024);
  });

  it('should return empty array if release for assets not found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const assets = await provider.listAssets('v1.0.0');
    expect(assets).toEqual([]);
  });

  it('should throw github_invalid_response on invalid JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token'); // Simulates JSON.parse failure
      }
    } as any);

    await expect(provider.getRelease('v1.0.0')).rejects.toThrow('github_invalid_response');
  });

  it('should throw github_invalid_response on unexpected structure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        foo: "bar" // Missing id and tag_name
      })
    } as any);

    await expect(provider.getRelease('v1.0.0')).rejects.toThrow('github_invalid_response');
  });
});
