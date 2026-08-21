import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { AdminWorkerClient } from './clients/worker';
import { EnvironmentCredentialProvider } from './providers/admin-auth-token';
import { GitHubUploadClient, UploadedGitHubAsset } from './clients/github';
import { EnvironmentGitHubCredentialProvider } from './providers/github-credentials';
import { WindowsCredentialStore, getDefaultCredentialStore, CREDENTIAL_TARGET_ADMIN, CREDENTIAL_TARGET_GITHUB } from './providers/windows-credentials';
import crypto from 'crypto';

export interface AppOptions {
    workerClient?: AdminWorkerClient;
    githubClient?: GitHubUploadClient;
    hasher?: (buffer: Buffer) => string;
    credentialStore?: WindowsCredentialStore;
}

interface ReleaseFileRecord {
    id: string;
    release_id: string;
    path: string;
    logical_path: string;
    filename?: string;
    operation: 'add' | 'replace' | 'delete';
    size: number;
    sha256?: string | null;
    part_index?: number | null;
    part_count?: number | null;
    final_sha256?: string | null;
}

interface ExpectedAssetRecord {
    fileId: string;
    name: string;
}

interface PrepareResponseRecord {
    github_tag: string;
    github_release_id: number;
    expectedAssets: ExpectedAssetRecord[];
}

interface StatusAssetItem {
    status: string;
    github_asset_id?: number;
    download_url?: string;
}

interface StatusResponseRecord {
    status: string;
    assetStatuses?: Record<string, StatusAssetItem>;
    unexpectedAssets?: { id: number; name: string }[];
}

export function createApp(options: AppOptions = {}) {
    const app = new Hono();

    app.use('*', cors({
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173']
    }));

    app.get('/health', (c) => c.json({ status: 'ok' }, 200));

    const store = options.credentialStore || getDefaultCredentialStore();
    const adminCredentialProvider = new EnvironmentCredentialProvider(store);
    const githubCredentialProvider = new EnvironmentGitHubCredentialProvider(store);

    const worker = options.workerClient || new AdminWorkerClient(
        process.env.WORKER_URL || 'https://launcherxd-api.campechanomichale06.workers.dev',
        adminCredentialProvider
    );

    const github = options.githubClient || new GitHubUploadClient({
        provider: githubCredentialProvider
    });

    const computeHash = options.hasher || ((buffer: Buffer) => crypto.createHash('sha256').update(buffer).digest('hex'));

    const handleProxy = async (c: Context, path: string) => {
        try {
            const method = c.req.method;
            const res = await worker.fetch(path, {
                method,
                body: method !== 'GET' && method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
                headers: {
                    'content-type': c.req.header('content-type') || 'application/json'
                }
            });
            const data = await res.arrayBuffer();
            return new Response(data, {
                status: res.status,
                headers: { 'content-type': res.headers.get('content-type') || 'application/json' }
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (message === 'ADMIN_UNAUTHORIZED') return c.json({ error: 'ADMIN_UNAUTHORIZED' }, 401);
            if (message === 'ADMIN_AUTH_NOT_CONFIGURED') return c.json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' }, 401);
            return c.json({ error: 'Internal error' }, 500);
        }
    };

    // Local Credentials Management
    app.get('/api/local/credentials/status', async (c) => {
        const adminToken = await adminCredentialProvider.getToken();
        const githubToken = await githubCredentialProvider.getToken();
        return c.json({
            admin: {
                configured: Boolean(adminToken && adminToken.trim().length > 0)
            },
            github: {
                configured: Boolean(githubToken && githubToken.trim().length > 0)
            }
        });
    });

    app.put('/api/local/credentials/admin', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        if (!body || typeof body.token !== 'string' || body.token.trim().length === 0) {
            return c.json({ error: 'INVALID_TOKEN', message: 'Token must be a non-empty string' }, 400);
        }
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', body.token.trim());
        return c.json({ configured: true });
    });

    app.put('/api/local/credentials/github', async (c) => {
        const body = await c.req.json().catch(() => ({}));
        if (!body || typeof body.token !== 'string' || body.token.trim().length === 0) {
            return c.json({ error: 'INVALID_TOKEN', message: 'Token must be a non-empty string' }, 400);
        }
        await store.set(CREDENTIAL_TARGET_GITHUB, 'GitHubUser', body.token.trim());
        return c.json({ configured: true });
    });

    app.delete('/api/local/credentials/admin', async (c) => {
        await store.delete(CREDENTIAL_TARGET_ADMIN);
        const remaining = await adminCredentialProvider.getToken();
        return c.json({ configured: Boolean(remaining && remaining.trim().length > 0) });
    });

    app.delete('/api/local/credentials/github', async (c) => {
        await store.delete(CREDENTIAL_TARGET_GITHUB);
        const remaining = await githubCredentialProvider.getToken();
        return c.json({ configured: Boolean(remaining && remaining.trim().length > 0) });
    });

    // Explicit Routes
    app.get('/api/admin/releases', (c) => handleProxy(c, '/api/admin/releases'));
    app.post('/api/admin/releases', (c) => handleProxy(c, '/api/admin/releases'));
    app.get('/api/admin/releases/:id', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}`));
    app.patch('/api/admin/releases/:id', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}`));
    app.delete('/api/admin/releases/:id', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}`));
    app.get('/api/admin/releases/:id/validation', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}/validation`));
    app.post('/api/admin/releases/:id/github/prepare', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}/github/prepare`));
    app.get('/api/admin/releases/:id/github/status', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}/github/status`));
    app.post('/api/admin/releases/:id/publish', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('id')}/publish`));

    app.get('/api/admin/releases/:releaseId/files', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('releaseId')}/files`));
    app.post('/api/admin/releases/:releaseId/files', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('releaseId')}/files`));
    app.patch('/api/admin/releases/:releaseId/files/:fileId', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('releaseId')}/files/${c.req.param('fileId')}`));
    app.delete('/api/admin/releases/:releaseId/files/:fileId', (c) => handleProxy(c, `/api/admin/releases/${c.req.param('releaseId')}/files/${c.req.param('fileId')}`));

    app.get('/api/admin/news', (c) => handleProxy(c, '/api/admin/news'));
    app.post('/api/admin/news', (c) => handleProxy(c, '/api/admin/news'));
    app.patch('/api/admin/news/:id', (c) => handleProxy(c, `/api/admin/news/${c.req.param('id')}`));
    app.delete('/api/admin/news/:id', (c) => handleProxy(c, `/api/admin/news/${c.req.param('id')}`));

    app.get('/api/admin/settings', (c) => handleProxy(c, '/api/admin/settings'));
    app.put('/api/admin/settings/:key', (c) => handleProxy(c, `/api/admin/settings/${encodeURIComponent(c.req.param('key'))}`));

    app.post('/api/local/file-inspect', async (c) => {
        try {
            const body = await c.req.parseBody();
            const file = body['file'];
            if (!file || typeof file === 'string') return c.json({ error: 'Invalid file' }, 400);

            if (file.size > 50 * 1024 * 1024) return c.json({ error: 'File too large for local inspect (max 50MB)' }, 400);

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const hash = computeHash(buffer);

            return c.json({
                filename: file.name,
                size: file.size,
                sha256: hash
            }, 200);
        } catch {
            return c.json({ error: 'Internal error' }, 500);
        }
    });

    // Real Binary Asset Upload Endpoint
    app.post('/api/local/releases/:releaseId/files/:fileId/upload', async (c) => {
        const releaseId = c.req.param('releaseId');
        const fileId = c.req.param('fileId');

        let fileBlob: Blob | null = null;
        const contentType = c.req.header('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
            const body = await c.req.parseBody();
            const file = body['file'];
            if (file && typeof file !== 'string') {
                fileBlob = file;
            }
        } else {
            const arr = await c.req.arrayBuffer();
            if (arr.byteLength > 0) {
                fileBlob = new Blob([arr]);
            }
        }

        if (!fileBlob) {
            return c.json({ error: 'FILE_NOT_FOUND', message: 'No file provided for upload' }, 400);
        }

        // 1. Fetch release file metadata from Worker API
        let releaseFiles: ReleaseFileRecord[] = [];
        try {
            const filesRes = await worker.fetch(`/api/admin/releases/${releaseId}/files`);
            if (filesRes.status === 404) {
                return c.json({ error: 'FILE_NOT_FOUND', message: 'Release not found' }, 404);
            }
            const json = (await filesRes.json()) as { value?: ReleaseFileRecord[] };
            releaseFiles = json.value || [];
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'ADMIN_UNAUTHORIZED') return c.json({ error: 'ADMIN_UNAUTHORIZED' }, 401);
            if (msg === 'ADMIN_AUTH_NOT_CONFIGURED') return c.json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' }, 401);
            return c.json({ error: 'Internal error' }, 500);
        }

        const releaseFile = releaseFiles.find((f) => f.id === fileId);
        if (!releaseFile) {
            return c.json({ error: 'FILE_NOT_FOUND', message: 'Release file not found' }, 404);
        }

        if (releaseFile.operation === 'delete') {
            return c.json({ error: 'NO_UPLOAD_REQUIRED', message: 'No upload required for delete operation' }, 400);
        }

        // 2. Validate file size and SHA-256
        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length !== releaseFile.size) {
            return c.json({
                error: 'FILE_SIZE_MISMATCH',
                message: `File size (${buffer.length} bytes) does not match expected release file size (${releaseFile.size} bytes)`
            }, 400);
        }

        const actualHash = computeHash(buffer);
        if (releaseFile.sha256 && actualHash.toLowerCase() !== releaseFile.sha256.toLowerCase()) {
            return c.json({
                error: 'FILE_SHA256_MISMATCH',
                message: `File SHA-256 (${actualHash}) does not match expected hash (${releaseFile.sha256})`
            }, 400);
        }

        // 3. Prepare GitHub Draft release and resolve expected asset name
        let prepareData: PrepareResponseRecord;
        try {
            const prepRes = await worker.fetch(`/api/admin/releases/${releaseId}/github/prepare`, {
                method: 'POST'
            });
            if (!prepRes.ok) {
                const errData = (await prepRes.json().catch(() => ({}))) as { error?: string; details?: string[] };
                return c.json({ error: errData.error || 'PREPARE_FAILED', details: errData.details }, prepRes.status as 400 | 404 | 409 | 500);
            }
            prepareData = (await prepRes.json()) as PrepareResponseRecord;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'ADMIN_UNAUTHORIZED') return c.json({ error: 'ADMIN_UNAUTHORIZED' }, 401);
            if (msg === 'ADMIN_AUTH_NOT_CONFIGURED') return c.json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' }, 401);
            return c.json({ error: 'Internal error' }, 500);
        }

        const expectedAsset = prepareData.expectedAssets?.find((a) => a.fileId === fileId);
        if (!expectedAsset || !expectedAsset.name) {
            return c.json({ error: 'ASSET_NAME_NOT_FOUND', message: 'Expected asset name not found in prepared release' }, 500);
        }

        const assetName = expectedAsset.name;
        const label = `sha256:${releaseFile.sha256}`;

        // 4. Upload raw binary to GitHub Releases API
        let uploadedAsset: UploadedGitHubAsset | null = null;
        try {
            uploadedAsset = await github.uploadAsset(
                prepareData.github_release_id,
                assetName,
                label,
                buffer
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'GITHUB_AUTH_NOT_CONFIGURED') {
                return c.json({ error: 'GITHUB_AUTH_NOT_CONFIGURED', message: 'GitHub upload credentials are not configured' }, 401);
            }
            if (msg === 'GITHUB_UNAUTHORIZED') {
                return c.json({ error: 'GITHUB_UNAUTHORIZED', message: 'GitHub authentication failed' }, 401);
            }
            if (msg === 'GITHUB_FORBIDDEN') {
                return c.json({ error: 'GITHUB_FORBIDDEN', message: 'GitHub upload forbidden' }, 403);
            }
            if (msg === 'GITHUB_NOT_FOUND') {
                return c.json({ error: 'GITHUB_NOT_FOUND', message: 'GitHub release or repository not found' }, 404);
            }
            if (msg === 'GITHUB_ASSET_CONFLICT') {
                // If asset already exists on GitHub, check if it's already verified and ready
                try {
                    const statusRes = await worker.fetch(`/api/admin/releases/${releaseId}/github/status`);
                    if (statusRes.ok) {
                        const statusData = (await statusRes.json()) as StatusResponseRecord;
                        const fileStat = statusData.assetStatuses?.[fileId];
                        if (fileStat?.status === 'ready') {
                            return c.json({
                                status: 'ok',
                                verified: true,
                                message: 'Already uploaded and verified',
                                asset: {
                                    id: fileStat.github_asset_id || 0,
                                    name: assetName,
                                    download_url: fileStat.download_url
                                }
                            }, 200);
                        }
                    }
                } catch {
                    // fall through
                }
                return c.json({
                    error: 'GITHUB_ASSET_CONFLICT',
                    message: 'Existing asset does not match expected metadata'
                }, 409);
            }
            return c.json({ error: 'UPLOAD_FAILED', message: msg || 'Failed to upload asset to GitHub' }, 500);
        }

        // 5. Verify status with Worker
        try {
            const statusRes = await worker.fetch(`/api/admin/releases/${releaseId}/github/status`);
            if (statusRes.ok) {
                const statusData = (await statusRes.json()) as StatusResponseRecord;
                const fileStat = statusData.assetStatuses?.[fileId];
                if (fileStat?.status === 'ready') {
                    return c.json({
                        status: 'ok',
                        verified: true,
                        asset: uploadedAsset
                    }, 200);
                }
            }
            return c.json({
                status: 'ok',
                verified: false,
                warning: 'UPLOAD_NOT_VERIFIED',
                asset: uploadedAsset
            }, 200);
        } catch {
            return c.json({
                status: 'ok',
                verified: false,
                warning: 'UPLOAD_NOT_VERIFIED',
                asset: uploadedAsset
            }, 200);
        }
    });

    return app;
}
