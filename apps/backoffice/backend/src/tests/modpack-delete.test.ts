import { test, expect, describe, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { AdminWorkerClient } from '../clients/worker';
import { GitHubUploadClient } from '../clients/github';
import { WindowsCredentialStore } from '../providers/windows-credentials';

interface DeleteEverywhereSuccessBody {
    status: string;
    deleted: boolean;
    purged: boolean;
    release_id: string;
    github_release_deleted: boolean;
    github_tag_deleted: boolean;
    d1_deleted: boolean;
    deletion_steps: {
        github_release: string;
        github_tag: string;
        d1: string;
    };
    github_resolution: string;
}

interface ErrorResponseBody {
    error: string;
    message?: string;
    details?: unknown;
    deletion_steps?: {
        github_release: string;
        github_tag: string;
        d1: string;
    };
    github_resolution?: string;
}

describe('Safe Modpack Purge Everywhere Backend Tests (Phase 7 Final)', () => {
    let mockWorker: AdminWorkerClient;
    let mockGithub: GitHubUploadClient;
    let mockStore: WindowsCredentialStore;

    const mockModpackDraftUnprepared = {
        id: 'modpack-draft-1',
        version: '1.2.3',
        channel: 'stable',
        release_type: 'modpack',
        status: 'draft',
        github_tag: null,
        github_release_id: null
    };

    const mockModpackDraftPrepared = {
        id: 'modpack-draft-prep',
        version: '2.0.0',
        channel: 'beta',
        release_type: 'modpack',
        status: 'draft',
        github_tag: 'modpack-beta-v2.0.0',
        github_release_id: 888123
    };

    const mockModpackPublished = {
        id: 'modpack-pub-1',
        version: '1.0.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'published',
        github_tag: 'modpack-stable-v1.0.0',
        github_release_id: 777123
    };

    const mockModpackDeprecated = {
        id: 'modpack-dep-1',
        version: '0.9.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'deprecated',
        github_tag: 'modpack-stable-v0.9.0',
        github_release_id: 666123
    };

    const mockLauncherDraft = {
        id: 'launcher-draft-1',
        version: '1.0.0',
        channel: 'stable',
        release_type: 'launcher',
        status: 'draft',
        github_tag: null,
        github_release_id: null
    };

    const mockCapabilityOk = {
        available: true,
        release_id: 'modpack-draft-1',
        release_type: 'modpack',
        status: 'draft',
        version: '1.2.3'
    };

    beforeEach(() => {
        vi.restoreAllMocks();

        mockStore = {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn()
        };

        mockWorker = {
            fetch: vi.fn()
        } as unknown as AdminWorkerClient;

        mockGithub = {
            uploadAsset: vi.fn(),
            getReleaseByTag: vi.fn().mockResolvedValue(null),
            deleteRelease: vi.fn().mockResolvedValue('deleted'),
            deleteTagIfExists: vi.fn().mockResolvedValue('deleted')
        } as unknown as GitHubUploadClient;
    });

    // 1. PREFLIGHT FALLIDO: WORKER NO DESPLEGADO DEVUELVE 503 Y NO ELIMINA NADA
    test('1. Preflight returning 404/unavailable returns 503 PURGE_ENDPOINT_UNAVAILABLE without deleting anything', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 })) // GET release
            .mockResolvedValueOnce(new Response('Not Found', { status: 404 })); // GET purge-capability 404

        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists');
        const tagLookupSpy = vi.spyOn(mockGithub, 'getReleaseByTag');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(503);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PURGE_ENDPOINT_UNAVAILABLE');
        expect(data.message).toContain('The purge endpoint is unavailable');
        expect(data.deletion_steps).toEqual({
            github_release: 'pending',
            github_tag: 'pending',
            d1: 'pending'
        });
        expect(tagLookupSpy).not.toHaveBeenCalled();
        expect(delRelSpy).not.toHaveBeenCalled();
        expect(delTagSpy).not.toHaveBeenCalled();
    });

    // 1b. PREFLIGHT RETORNA HTTP 200 CON JSON MALFORMADO -> 503 SIN ACCIÓN DESTRUCTIVA
    test('1b. Preflight returning HTTP 200 with malformed JSON returns 503 and executes no destructive operations', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response('not-valid-json{{{', { status: 200, headers: { 'content-type': 'application/json' } }));

        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists');
        const tagLookupSpy = vi.spyOn(mockGithub, 'getReleaseByTag');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(503);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PURGE_ENDPOINT_UNAVAILABLE');
        expect(data.deletion_steps).toEqual({
            github_release: 'pending',
            github_tag: 'pending',
            d1: 'pending'
        });
        expect(tagLookupSpy).not.toHaveBeenCalled();
        expect(delRelSpy).not.toHaveBeenCalled();
        expect(delTagSpy).not.toHaveBeenCalled();
    });

    // 1c. PREFLIGHT RETORNA HTTP 200 CON available: false -> 503 SIN ACCIÓN DESTRUCTIVA
    test('1c. Preflight returning available: false returns 503 and executes no destructive operations', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, available: false }), { status: 200 }));

        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(503);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PURGE_ENDPOINT_UNAVAILABLE');
        expect(delRelSpy).not.toHaveBeenCalled();
        expect(delTagSpy).not.toHaveBeenCalled();
    });

    // 1d. PREFLIGHT RETORNA HTTP 200 CON release_id DISCREPANTE -> 503 SIN ACCIÓN DESTRUCTIVA
    test('1d. Preflight returning mismatched release_id returns 503 and executes no destructive operations', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'different-id' }), { status: 200 }));

        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(503);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PURGE_ENDPOINT_UNAVAILABLE');
        expect(delRelSpy).not.toHaveBeenCalled();
        expect(delTagSpy).not.toHaveBeenCalled();
    });

    // 1e. PREFLIGHT RETORNA HTTP 200 CON VERSIÓN O ESTADO DISCREPANTE -> 503 SIN ACCIÓN DESTRUCTIVA
    test('1e. Preflight returning mismatched version or status returns 503 and executes no destructive operations', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-draft-prep', version: '9.9.9' }), { status: 200 }));

        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(503);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PURGE_ENDPOINT_UNAVAILABLE');
        expect(delRelSpy).not.toHaveBeenCalled();
        expect(delTagSpy).not.toHaveBeenCalled();
    });

    // 2. RESOLUCIÓN VÍA METADATA D1
    test('2. Resolves GitHub Release via D1 metadata when github_release_id is present', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-draft-prep', version: '2.0.0' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', purged: true }), { status: 200 }));

        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('deleted');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('deleted');
        const tagLookupSpy = vi.spyOn(mockGithub, 'getReleaseByTag');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as DeleteEverywhereSuccessBody;
        expect(data.github_resolution).toBe('metadata');
        expect(data.github_release_deleted).toBe(true);
        expect(data.github_tag_deleted).toBe(true);
        expect(data.d1_deleted).toBe(true);
        expect(data.deletion_steps).toEqual({
            github_release: 'deleted',
            github_tag: 'deleted',
            d1: 'deleted'
        });
        expect(delRelSpy).toHaveBeenCalledWith(888123);
        expect(delTagSpy).toHaveBeenCalledWith('modpack-beta-v2.0.0');
        expect(tagLookupSpy).not.toHaveBeenCalled();
    });

    // 3. RECUPERACIÓN DE RELEASE HUÉRFANA VÍA TAG CANÓNICO
    test('3. Recovers orphan GitHub Release via canonical tag lookup when D1 metadata is missing', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftUnprepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(mockCapabilityOk), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', purged: true }), { status: 200 }));

        // Canonical tag: modpack-stable-v1.2.3
        const tagLookupSpy = vi.spyOn(mockGithub, 'getReleaseByTag').mockResolvedValue({
            id: 999111,
            tag_name: 'modpack-stable-v1.2.3'
        });
        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('deleted');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('deleted');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-1/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '1.2.3', confirm_phrase: 'DELETE 1.2.3' })
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as DeleteEverywhereSuccessBody;
        expect(data.github_resolution).toBe('canonical_tag_lookup');
        expect(data.github_release_deleted).toBe(true);
        expect(data.github_tag_deleted).toBe(true);
        expect(data.d1_deleted).toBe(true);
        expect(tagLookupSpy).toHaveBeenCalledWith('modpack-stable-v1.2.3');
        expect(delRelSpy).toHaveBeenCalledWith(999111);
        expect(delTagSpy).toHaveBeenCalledWith('modpack-stable-v1.2.3');
    });

    // 4. TAG CANÓNICO 404 SIGNIFICA not_present
    test('4. Canonical tag lookup returning null marks resolution as not_present and continues', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftUnprepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(mockCapabilityOk), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', purged: true }), { status: 200 }));

        vi.spyOn(mockGithub, 'getReleaseByTag').mockResolvedValue(null);
        const delRelSpy = vi.spyOn(mockGithub, 'deleteRelease');
        const delTagSpy = vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('not_present');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-1/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '1.2.3', confirm_phrase: 'DELETE 1.2.3' })
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as DeleteEverywhereSuccessBody;
        expect(data.github_resolution).toBe('not_present');
        expect(data.github_release_deleted).toBe(false);
        expect(data.deletion_steps.github_release).toBe('not_present');
        expect(data.deletion_steps.github_tag).toBe('not_present');
        expect(data.d1_deleted).toBe(true);
        expect(delRelSpy).not.toHaveBeenCalled();
        expect(delTagSpy).toHaveBeenCalledWith('modpack-stable-v1.2.3');
    });

    // 5. PURGA DE MODPACK PUBLICADO CON CONFIRMACIONES
    test('5. Purges published modpack everywhere with dual confirmations', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackPublished), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-pub-1', status: 'published', version: '1.0.0' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', purged: true }), { status: 200 }));

        vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('deleted');
        vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('deleted');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-pub-1/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '1.0.0', confirm_phrase: 'DELETE 1.0.0' })
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as DeleteEverywhereSuccessBody;
        expect(data.purged).toBe(true);
        expect(data.deletion_steps).toEqual({
            github_release: 'deleted',
            github_tag: 'deleted',
            d1: 'deleted'
        });
    });

    // 6. PURGA DE MODPACK DEPRECADO CON CONFIRMACIONES
    test('6. Purges deprecated modpack everywhere with dual confirmations', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDeprecated), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-dep-1', status: 'deprecated', version: '0.9.0' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', purged: true }), { status: 200 }));

        vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('deleted');
        vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('deleted');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-dep-1/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '0.9.0', confirm_phrase: 'DELETE 0.9.0' })
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as DeleteEverywhereSuccessBody;
        expect(data.purged).toBe(true);
    });

    // 7. GITHUB RELEASE ELIMINADA + GIT TAG FALLA CON GITHUB_UNAUTHORIZED: PARTIAL_DELETION_ERROR SIN LLAMAR A D1
    test('7. GitHub Release deleted but Git tag fails with GITHUB_UNAUTHORIZED returns PARTIAL_DELETION_ERROR without calling D1', async () => {
        const purgeD1Spy = vi.fn();
        vi.spyOn(mockWorker, 'fetch').mockImplementation(async (path: string) => {
            if (path.includes('/purge-capability')) {
                return new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-draft-prep', version: '2.0.0' }), { status: 200 });
            }
            if (path.includes('/purge')) {
                purgeD1Spy();
                return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
            }
            return new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 });
        });

        vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('deleted');
        vi.spyOn(mockGithub, 'deleteTagIfExists').mockRejectedValue(new Error('GITHUB_UNAUTHORIZED'));

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(502);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PARTIAL_DELETION_ERROR');
        expect(data.message).toContain('Failed to delete Git tag: GITHUB_UNAUTHORIZED');
        expect(data.deletion_steps).toEqual({
            github_release: 'deleted',
            github_tag: 'failed',
            d1: 'pending'
        });
        expect(purgeD1Spy).not.toHaveBeenCalled();
    });

    // 8. GITHUB TERMINA + D1 PURGE FALLA: PARTIAL_DELETION_ERROR
    test('8. GitHub succeeds but D1 purge fails returns PARTIAL_DELETION_ERROR', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-draft-prep', version: '2.0.0' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'd1_lock_timeout' }), { status: 500 }));

        vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('deleted');
        vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('deleted');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(500);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('PARTIAL_DELETION_ERROR');
        expect(data.deletion_steps).toEqual({
            github_release: 'deleted',
            github_tag: 'deleted',
            d1: 'failed'
        });
    });

    // 9. REINTENTO COMPLETA D1 IDEMPOTENTEMENTE
    test('9. Retry after partial failure handles GitHub 404 (not_present) and successfully completes D1 purge', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...mockCapabilityOk, release_id: 'modpack-draft-prep', version: '2.0.0' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', purged: true }), { status: 200 }));

        // On retry, GitHub returns not_present because release and tag were already deleted
        vi.spyOn(mockGithub, 'deleteRelease').mockResolvedValue('not_present');
        vi.spyOn(mockGithub, 'deleteTagIfExists').mockResolvedValue('not_present');

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 2.0.0' })
        });

        expect(res.status).toBe(200);
        const data = (await res.json()) as DeleteEverywhereSuccessBody;
        expect(data.purged).toBe(true);
        expect(data.deletion_steps).toEqual({
            github_release: 'not_present',
            github_tag: 'not_present',
            d1: 'deleted'
        });
    });

    // 10. RECHAZA LAUNCHER RELEASES
    test('10. Rejects launcher release deletion with 400', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockLauncherDraft), { status: 200 }));

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        const res = await app.request('/api/local/releases/launcher-draft-1/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '1.0.0', confirm_phrase: 'DELETE 1.0.0' })
        });

        expect(res.status).toBe(400);
        const data = (await res.json()) as ErrorResponseBody;
        expect(data.error).toBe('invalid_release_type');
    });

    // 11. CONFIRMACIÓN DISCREPANTE RECHAZADA
    test('11. Rejects mismatched confirmation version or phrase with 400', async () => {
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }));

        const app = createApp({ workerClient: mockWorker, githubClient: mockGithub, credentialStore: mockStore });

        // Mismatched version
        const res1 = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '9.9.9', confirm_phrase: 'DELETE 2.0.0' })
        });
        expect(res1.status).toBe(400);

        // Mismatched phrase
        vi.spyOn(mockWorker, 'fetch')
            .mockResolvedValueOnce(new Response(JSON.stringify(mockModpackDraftPrepared), { status: 200 }));

        const res2 = await app.request('/api/local/releases/modpack-draft-prep/delete-everywhere', {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm_version: '2.0.0', confirm_phrase: 'DELETE 9.9.9' })
        });
        expect(res2.status).toBe(400);
    });
});
