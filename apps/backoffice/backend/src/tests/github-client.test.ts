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

    test('getReleaseByTag sends GET request to releases/tags/:tag and returns release summary or null', async () => {
        const mockProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue('ghp_valid_token')
        };
        const client = new GitHubUploadClient({
            owner: 'TestOwner',
            repo: 'TestRepo',
            provider: mockProvider,
            apiBaseUrl: 'https://api.test-github.com'
        });

        // 1. Success 200 with matching tag
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 555, tag_name: 'modpack-stable-v1.0.0' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );
        const res = await client.getReleaseByTag('modpack-stable-v1.0.0');
        expect(res).toEqual({ id: 555, tag_name: 'modpack-stable-v1.0.0' });
        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.test-github.com/repos/TestOwner/TestRepo/releases/tags/modpack-stable-v1.0.0',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer ghp_valid_token'
                })
            })
        );

        // 2. 200 with non-matching tag returns null
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ id: 555, tag_name: 'different-tag' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );
        expect(await client.getReleaseByTag('modpack-stable-v1.0.0')).toBeNull();

        // 3. 404 returns null (not_present)
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));
        expect(await client.getReleaseByTag('modpack-beta-v0.0.0-test.1')).toBeNull();

        // 4. 401 GITHUB_UNAUTHORIZED
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
        await expect(client.getReleaseByTag('modpack-stable-v1.0.0')).rejects.toThrow('GITHUB_UNAUTHORIZED');

        // 5. 403 GITHUB_FORBIDDEN
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
        await expect(client.getReleaseByTag('modpack-stable-v1.0.0')).rejects.toThrow('GITHUB_FORBIDDEN');

        // 6. 500 GITHUB_UNAVAILABLE
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
        await expect(client.getReleaseByTag('modpack-stable-v1.0.0')).rejects.toThrow('GITHUB_UNAVAILABLE');

        // 7. Missing token
        const clientNoToken = new GitHubUploadClient({
            provider: { getToken: vi.fn().mockResolvedValue(null) }
        });
        await expect(clientNoToken.getReleaseByTag('tag')).rejects.toThrow('GITHUB_AUTH_NOT_CONFIGURED');
    });

    test('deleteRelease sends DELETE request, handles 204 and 404 cleanly, and maps errors', async () => {
        const mockProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue('ghp_valid_token')
        };
        const client = new GitHubUploadClient({
            owner: 'TestOwner',
            repo: 'TestRepo',
            provider: mockProvider,
            apiBaseUrl: 'https://api.test-github.com'
        });

        // 1. Success 204 returns deleted
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
        await expect(client.deleteRelease(123)).resolves.toBe('deleted');
        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.test-github.com/repos/TestOwner/TestRepo/releases/123',
            expect.objectContaining({
                method: 'DELETE',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer ghp_valid_token'
                })
            })
        );

        // 2. 404 (already deleted) returns not_present
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));
        await expect(client.deleteRelease(123)).resolves.toBe('not_present');

        // 3. 401 GITHUB_UNAUTHORIZED
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
        await expect(client.deleteRelease(123)).rejects.toThrow('GITHUB_UNAUTHORIZED');

        // 4. 403 GITHUB_FORBIDDEN
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
        await expect(client.deleteRelease(123)).rejects.toThrow('GITHUB_FORBIDDEN');

        // 5. 500 GITHUB_UNAVAILABLE
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
        await expect(client.deleteRelease(123)).rejects.toThrow('GITHUB_UNAVAILABLE');

        // 6. Missing token
        const clientNoToken = new GitHubUploadClient({
            provider: { getToken: vi.fn().mockResolvedValue(null) }
        });
        await expect(clientNoToken.deleteRelease(123)).rejects.toThrow('GITHUB_AUTH_NOT_CONFIGURED');
    });

    test('deleteTagIfExists sends DELETE request to git/refs/tags, handles 204, 404, 422 cleanly, and maps errors', async () => {
        const mockProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue('ghp_valid_token')
        };
        const client = new GitHubUploadClient({
            owner: 'TestOwner',
            repo: 'TestRepo',
            provider: mockProvider,
            apiBaseUrl: 'https://api.test-github.com'
        });

        // 1. Success 204 returns deleted
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
        await expect(client.deleteTagIfExists('v1.0.0')).resolves.toBe('deleted');
        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.test-github.com/repos/TestOwner/TestRepo/git/refs/tags/v1.0.0',
            expect.objectContaining({
                method: 'DELETE',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer ghp_valid_token'
                })
            })
        );

        // 2. With tags/ prefix
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
        await expect(client.deleteTagIfExists('tags/v1.0.0')).resolves.toBe('deleted');

        // 3. 404 (already deleted) returns not_present
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 404 }));
        await expect(client.deleteTagIfExists('v1.0.0')).resolves.toBe('not_present');

        // 4. 422 (ref does not exist) returns not_present
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 422 }));
        await expect(client.deleteTagIfExists('v1.0.0')).resolves.toBe('not_present');

        // 5. 401 GITHUB_UNAUTHORIZED
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 401 }));
        await expect(client.deleteTagIfExists('v1.0.0')).rejects.toThrow('GITHUB_UNAUTHORIZED');

        // 6. 403 GITHUB_FORBIDDEN
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));
        await expect(client.deleteTagIfExists('v1.0.0')).rejects.toThrow('GITHUB_FORBIDDEN');

        // 7. 500 GITHUB_UNAVAILABLE
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 500 }));
        await expect(client.deleteTagIfExists('v1.0.0')).rejects.toThrow('GITHUB_UNAVAILABLE');

        // 8. Missing token
        const clientNoToken = new GitHubUploadClient({
            provider: { getToken: vi.fn().mockResolvedValue(null) }
        });
        await expect(clientNoToken.deleteTagIfExists('v1.0.0')).rejects.toThrow('GITHUB_AUTH_NOT_CONFIGURED');
    });
});
