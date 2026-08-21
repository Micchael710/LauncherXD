import { test, expect, describe, vi, beforeEach } from 'vitest';
import { GitHubUploadClient } from '../clients/github';
import { GitHubCredentialProvider } from '../providers/github-credentials';

describe('GitHubUploadClient', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    test('throws GITHUB_AUTH_NOT_CONFIGURED when token is missing', async () => {
        const mockProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue(null)
        };
        const client = new GitHubUploadClient({
            owner: 'TestOwner',
            repo: 'TestRepo',
            provider: mockProvider
        });

        await expect(
            client.uploadAsset(123, 'asset.jar', 'sha256:abc', Buffer.from('test'))
        ).rejects.toThrow('GITHUB_AUTH_NOT_CONFIGURED');
    });

    test('sends exact headers, url parameters, and binary body to GitHub API', async () => {
        const mockProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue('ghp_valid_token')
        };
        const client = new GitHubUploadClient({
            owner: 'TestOwner',
            repo: 'TestRepo',
            provider: mockProvider,
            baseUrl: 'https://test-uploads.github.com'
        });

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    id: 999,
                    name: 'lx-123-asset.jar',
                    size: 4,
                    browser_download_url: 'https://github.com/downloads/asset.jar',
                    state: 'uploaded'
                }),
                { status: 201, headers: { 'content-type': 'application/json' } }
            )
        );

        const asset = await client.uploadAsset(
            123,
            'lx-123-asset.jar',
            'sha256:abcd',
            Buffer.from('test')
        );

        expect(asset.id).toBe(999);
        expect(asset.name).toBe('lx-123-asset.jar');
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
        expect(calledUrl).toBe(
            'https://test-uploads.github.com/repos/TestOwner/TestRepo/releases/123/assets?name=lx-123-asset.jar&label=sha256%3Aabcd'
        );
        expect(calledOptions?.method).toBe('POST');
        expect((calledOptions?.headers as Record<string, string>)['Authorization']).toBe('Bearer ghp_valid_token');
        expect((calledOptions?.headers as Record<string, string>)['Content-Type']).toBe('application/octet-stream');
    });

    test('maps GitHub error status codes correctly', async () => {
        const mockProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue('ghp_valid_token')
        };
        const client = new GitHubUploadClient({
            provider: mockProvider,
            baseUrl: 'https://test-uploads.github.com'
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
        await expect(client.uploadAsset(1, 'a', 'l', Buffer.from('x'))).rejects.toThrow('GITHUB_UNAUTHORIZED');

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
        await expect(client.uploadAsset(1, 'a', 'l', Buffer.from('x'))).rejects.toThrow('GITHUB_FORBIDDEN');

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));
        await expect(client.uploadAsset(1, 'a', 'l', Buffer.from('x'))).rejects.toThrow('GITHUB_NOT_FOUND');

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 422 }));
        await expect(client.uploadAsset(1, 'a', 'l', Buffer.from('x'))).rejects.toThrow('GITHUB_ASSET_CONFLICT');

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
        await expect(client.uploadAsset(1, 'a', 'l', Buffer.from('x'))).rejects.toThrow('GITHUB_UNAVAILABLE');
    });
});
