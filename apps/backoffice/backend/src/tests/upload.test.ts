import { test, expect, describe, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { AdminWorkerClient } from '../clients/worker';
import { GitHubUploadClient } from '../clients/github';
import { CredentialProvider } from '../providers/admin-auth-token';
import { GitHubCredentialProvider } from '../providers/github-credentials';

describe('POST /api/local/releases/:releaseId/files/:fileId/upload', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockAdminProvider: CredentialProvider = {
        getToken: vi.fn().mockResolvedValue('test-admin-token')
    };

    const mockGitHubProvider: GitHubCredentialProvider = {
        getToken: vi.fn().mockResolvedValue('test-github-token')
    };

    const validTestSha = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'; // sha256('test')

    const mockReleaseFiles = [
        {
            id: 'file-1',
            release_id: 'rel-1',
            path: 'mods/sodium.jar',
            logical_path: 'mods/sodium.jar',
            filename: 'sodium.jar',
            operation: 'add',
            size: 4,
            sha256: validTestSha
        },
        {
            id: 'file-delete',
            release_id: 'rel-1',
            path: 'old-mod.jar',
            logical_path: 'old-mod.jar',
            filename: 'old-mod.jar',
            operation: 'delete',
            size: 0,
            sha256: null
        }
    ];

    const mockPrepareResponse = {
        github_tag: 'launcher-stable-v1.0.0',
        github_release_id: 555,
        expectedAssets: [
            {
                fileId: 'file-1',
                name: 'lx-abcdef123456-sodium.jar'
            }
        ]
    };

    const mockStatusResponseReady = {
        status: 'ready',
        assetStatuses: {
            'file-1': {
                status: 'ready',
                github_asset_id: 1001,
                download_url: 'https://github.com/downloads/sodium.jar'
            }
        },
        unexpectedAssets: []
    };

    test('rejects with 400 when no file is provided', async () => {
        const app = createApp({
            workerClient: new AdminWorkerClient('http://mock-worker', mockAdminProvider),
            githubClient: new GitHubUploadClient({ provider: mockGitHubProvider })
        });

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST'
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as { error: string };
        expect(data.error).toBe('FILE_NOT_FOUND');
    });

    test('rejects with 404 when release or file is not found', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
        );

        const app = createApp({
            workerClient,
            githubClient: new GitHubUploadClient({ provider: mockGitHubProvider })
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('test')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-unknown/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(404);
        const data = (await res.json()) as { error: string };
        expect(data.error).toBe('FILE_NOT_FOUND');
    });

    test('rejects with 400 NO_UPLOAD_REQUIRED for operation: delete', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } })
        );

        const app = createApp({
            workerClient,
            githubClient: new GitHubUploadClient({ provider: mockGitHubProvider })
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('test')]), 'old-mod.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-delete/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as { error: string };
        expect(data.error).toBe('NO_UPLOAD_REQUIRED');
    });

    test('rejects with 400 FILE_SIZE_MISMATCH when size differs from metadata', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } })
        );

        const app = createApp({
            workerClient,
            githubClient: new GitHubUploadClient({ provider: mockGitHubProvider })
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('different_size_content')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as { error: string };
        expect(data.error).toBe('FILE_SIZE_MISMATCH');
    });

    test('rejects with 400 FILE_SHA256_MISMATCH when content hash differs from metadata', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } })
        );

        const app = createApp({
            workerClient,
            githubClient: new GitHubUploadClient({ provider: mockGitHubProvider })
        });

        const formData = new FormData();
        // 4 bytes, but different content -> 'fail' instead of 'test'
        formData.append('file', new Blob([Buffer.from('fail')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as { error: string };
        expect(data.error).toBe('FILE_SHA256_MISMATCH');
    });

    test('returns 401 GITHUB_AUTH_NOT_CONFIGURED when GITHUB_TOKEN is missing', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch')
            // 1. files
            .mockResolvedValueOnce(new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 2. prepare
            .mockResolvedValueOnce(new Response(JSON.stringify(mockPrepareResponse), { status: 200, headers: { 'content-type': 'application/json' } }));

        const missingGitHubProvider: GitHubCredentialProvider = {
            getToken: vi.fn().mockResolvedValue(null)
        };

        const app = createApp({
            workerClient,
            githubClient: new GitHubUploadClient({ provider: missingGitHubProvider })
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('test')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(401);
        const data = (await res.json()) as { error: string };
        expect(data.error).toBe('GITHUB_AUTH_NOT_CONFIGURED');
    });

    test('successfully uploads asset to GitHub and verifies status ready', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch')
            // 1. files
            .mockResolvedValueOnce(new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 2. prepare
            .mockResolvedValueOnce(new Response(JSON.stringify(mockPrepareResponse), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 3. status check
            .mockResolvedValueOnce(new Response(JSON.stringify(mockStatusResponseReady), { status: 200, headers: { 'content-type': 'application/json' } }));

        const githubClient = new GitHubUploadClient({ provider: mockGitHubProvider });
        const uploadSpy = vi.spyOn(githubClient, 'uploadAsset').mockResolvedValueOnce({
            id: 1001,
            name: 'lx-abcdef123456-sodium.jar',
            size: 4,
            state: 'uploaded'
        });

        const app = createApp({
            workerClient,
            githubClient
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('test')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as { status: string; verified: boolean; asset: { id: number } };
        expect(data.status).toBe('ok');
        expect(data.verified).toBe(true);
        expect(data.asset.id).toBe(1001);

        expect(uploadSpy).toHaveBeenCalledWith(
            555,
            'lx-abcdef123456-sodium.jar',
            'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            expect.any(Buffer)
        );
    });

    test('handles 422 conflict with verified existing asset as success', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch')
            // 1. files
            .mockResolvedValueOnce(new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 2. prepare
            .mockResolvedValueOnce(new Response(JSON.stringify(mockPrepareResponse), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 3. status check after conflict
            .mockResolvedValueOnce(new Response(JSON.stringify(mockStatusResponseReady), { status: 200, headers: { 'content-type': 'application/json' } }));

        const githubClient = new GitHubUploadClient({ provider: mockGitHubProvider });
        vi.spyOn(githubClient, 'uploadAsset').mockRejectedValueOnce(new Error('GITHUB_ASSET_CONFLICT'));

        const app = createApp({
            workerClient,
            githubClient
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('test')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as { status: string; verified: boolean; message: string };
        expect(data.status).toBe('ok');
        expect(data.verified).toBe(true);
        expect(data.message).toBe('Already uploaded and verified');
    });

    test('returns warning when upload completes but status is not ready yet', async () => {
        const workerClient = new AdminWorkerClient('http://mock-worker', mockAdminProvider);
        vi.spyOn(workerClient, 'fetch')
            // 1. files
            .mockResolvedValueOnce(new Response(JSON.stringify({ value: mockReleaseFiles }), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 2. prepare
            .mockResolvedValueOnce(new Response(JSON.stringify(mockPrepareResponse), { status: 200, headers: { 'content-type': 'application/json' } }))
            // 3. status check returns syncing
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'syncing', assetStatuses: { 'file-1': { status: 'asset_not_uploaded' } } }), { status: 200, headers: { 'content-type': 'application/json' } }));

        const githubClient = new GitHubUploadClient({ provider: mockGitHubProvider });
        vi.spyOn(githubClient, 'uploadAsset').mockResolvedValueOnce({
            id: 1001,
            name: 'lx-abcdef123456-sodium.jar',
            size: 4,
            state: 'uploaded'
        });

        const app = createApp({
            workerClient,
            githubClient
        });

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from('test')]), 'sodium.jar');

        const res = await app.request('/api/local/releases/rel-1/files/file-1/upload', {
            method: 'POST',
            body: formData
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as { status: string; verified: boolean; warning: string };
        expect(data.status).toBe('ok');
        expect(data.verified).toBe(false);
        expect(data.warning).toBe('UPLOAD_NOT_VERIFIED');
    });
});
