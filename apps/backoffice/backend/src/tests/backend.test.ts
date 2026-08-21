import { test, expect, vi, describe, beforeEach } from 'vitest';
import { createApp } from '../app';
import { AdminWorkerClient } from '../clients/worker';
import { CredentialProvider } from '../providers/admin-auth-token';
import crypto from 'crypto';

describe('Local Backend API Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /health', () => {
        test('returns HTTP 200 with exact status ok body', async () => {
            const app = createApp();
            const res = await app.request('/health');
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual({ status: 'ok' });
        });
    });

    describe('CORS Allowlist', () => {
        test('allows http://localhost:5173 with matching header', async () => {
            const app = createApp();
            const res = await app.request('/health', {
                headers: { Origin: 'http://localhost:5173' }
            });
            expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
        });

        test('allows http://127.0.0.1:5173 with matching header', async () => {
            const app = createApp();
            const res = await app.request('/health', {
                headers: { Origin: 'http://127.0.0.1:5173' }
            });
            expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
        });

        test('does not return access-control-allow-origin for unauthorized origin', async () => {
            const app = createApp();
            const res = await app.request('/health', {
                headers: { Origin: 'http://unauthorized-domain.com' }
            });
            expect(res.headers.get('access-control-allow-origin')).toBeNull();
        });
    });

    describe('Releases CRUD Proxy & Route Allowlist', () => {
        test('GET /api/admin/releases forwards request and preserves status & body', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ value: [{ id: 'rel-1', version: '1.0.0' }], Count: 1 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases', { method: 'GET' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/releases', expect.objectContaining({ method: 'GET' }));
            const json = await res.json();
            expect(json).toEqual({ value: [{ id: 'rel-1', version: '1.0.0' }], Count: 1 });
        });

        test('GET /api/admin/releases/:id forwards id to worker', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ id: 'rel-42', version: '1.0.0', status: 'draft' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-42', { method: 'GET' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/releases/rel-42', expect.objectContaining({ method: 'GET' }));
            const json = await res.json();
            expect(json).toEqual({ id: 'rel-42', version: '1.0.0', status: 'draft' });
        });

        test('POST /api/admin/releases preserves body, method, and content-type', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const payload = JSON.stringify({ version: '1.2.0', channel: 'stable', release_type: 'launcher' });

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ id: 'new-rel-id', status: 'created' }), {
                    status: 201,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: payload
            });

            expect(res.status).toBe(201);
            expect(capturedPath).toBe('/api/admin/releases');
            expect(capturedOptions).toBeDefined();
            expect(capturedOptions?.method).toBe('POST');

            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual({
                version: '1.2.0',
                channel: 'stable',
                release_type: 'launcher'
            });
        });

        test('PATCH /api/admin/releases/:id preserves ID, body, method, and content-type', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const patchPayload = JSON.stringify({ channel: 'beta' });

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-99', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: patchPayload
            });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/releases/rel-99');
            expect(capturedOptions).toBeDefined();
            expect(capturedOptions?.method).toBe('PATCH');

            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual({ channel: 'beta' });
        });

        test('DELETE /api/admin/releases/:id preserves ID and method', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-delete', { method: 'DELETE' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/releases/rel-delete', expect.objectContaining({
                method: 'DELETE'
            }));
        });

        test('Worker error status and JSON with details are preserved', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'conflict', details: ['duplicate_release'] }), {
                    status: 409,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ version: '1.0.0', channel: 'stable', release_type: 'launcher' })
            });

            expect(res.status).toBe(409);
            const json = await res.json();
            expect(json).toEqual({ error: 'conflict', details: ['duplicate_release'] });
        });

        test('disallowed HTTP method does not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases', { method: 'PUT' });

            expect(res.status).toBe(404);
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        test('unknown admin path does not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/unknown-endpoint', { method: 'GET' });

            expect(res.status).toBe(404);
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Release Files Proxy & Route Allowlist', () => {
        test('GET /api/admin/releases/:releaseId/files preserves route, method, status and body', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const mockFiles = [{ id: 'f-1', path: 'launcher.jar', size: 1024 }];
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ value: mockFiles, Count: 1 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-100/files', { method: 'GET' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/releases/rel-100/files', expect.objectContaining({ method: 'GET' }));
            const json = await res.json();
            expect(json).toEqual({ value: mockFiles, Count: 1 });
        });

        test('POST /api/admin/releases/:releaseId/files preserves releaseId, method, content-type, body and status', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const filePayload = {
                path: 'mods/optifine.jar',
                logical_path: 'mods/optifine.jar',
                operation: 'add',
                size: 2048,
                sha256: 'a'.repeat(64)
            };

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ id: 'file-created-id', status: 'created' }), {
                    status: 201,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-100/files', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(filePayload)
            });

            expect(res.status).toBe(201);
            expect(capturedPath).toBe('/api/admin/releases/rel-100/files');
            expect(capturedOptions?.method).toBe('POST');
            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual(filePayload);
            const json = await res.json();
            expect(json).toEqual({ id: 'file-created-id', status: 'created' });
        });

        test('PATCH /api/admin/releases/:releaseId/files/:fileId preserves both IDs, method, content-type and body', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const patchPayload = { size: 4096 };

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-100/files/file-200', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(patchPayload)
            });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/releases/rel-100/files/file-200');
            expect(capturedOptions?.method).toBe('PATCH');
            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual(patchPayload);
        });

        test('DELETE /api/admin/releases/:releaseId/files/:fileId preserves both IDs and method', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-100/files/file-300', { method: 'DELETE' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/releases/rel-100/files/file-300', expect.objectContaining({
                method: 'DELETE'
            }));
        });

        test('Release Files proxy preserves 400 validation error with structured details', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const structuredDetail = [{ code: 'invalid_path', path: '../unsafe.jar' }];
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'validation_error', details: structuredDetail }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-100/files', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ path: '../unsafe.jar' })
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'validation_error', details: structuredDetail });
        });

        test('Release Files proxy preserves 409 conflict with release_not_draft', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'conflict', details: ['release_not_draft'] }), {
                    status: 409,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-published/files', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ path: 'a.jar' })
            });

            expect(res.status).toBe(409);
            const json = await res.json();
            expect(json).toEqual({ error: 'conflict', details: ['release_not_draft'] });
        });

        test('Release Files proxy preserves 404 not_found when release does not exist', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'not_found' }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-nonexistent/files', { method: 'GET' });

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json).toEqual({ error: 'not_found' });
        });

        test('disallowed HTTP method on release files does not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-100/files', { method: 'PUT' });

            expect(res.status).toBe(404);
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Release Validation Proxy & Route Allowlist', () => {
        test('GET /api/admin/releases/:id/validation forwards id, GET method, preserves status and valid body', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const validationPayload = { valid: true, issues: [] };
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify(validationPayload), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-valid-1/validation', { method: 'GET' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/releases/rel-valid-1/validation', expect.objectContaining({
                method: 'GET'
            }));
            const json = await res.json();
            expect(json).toEqual(validationPayload);
        });

        test('GET /api/admin/releases/:id/validation forwards issues when release is invalid', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const validationPayload = {
                valid: false,
                issues: [
                    { code: 'multipart_missing_part', path: 'bin/launcher.jar', message: 'Missing part 2' }
                ]
            };
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify(validationPayload), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-invalid-1/validation', { method: 'GET' });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json).toEqual(validationPayload);
        });

        test('GET /api/admin/releases/:id/validation preserves 404 not_found', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'not_found' }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-missing/validation', { method: 'GET' });

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json).toEqual({ error: 'not_found' });
        });

        test('disallowed HTTP method on validation endpoint does not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/releases/rel-1/validation', { method: 'POST' });

            expect(res.status).toBe(404);
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('News Proxy Route Allowlist & Method Handling', () => {
        test('GET /api/admin/news forwards route, GET method, and returns 200 list response', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const newsPayload = {
                value: [
                    { id: 'news-1', title: 'Welcome', published: 1, created_at: '2026-08-20T00:00:00Z', updated_at: '2026-08-20T00:00:00Z' }
                ],
                Count: 1
            };
            const fetchSpy = vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify(newsPayload), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news', { method: 'GET' });

            expect(res.status).toBe(200);
            expect(fetchSpy).toHaveBeenCalledWith('/api/admin/news', expect.objectContaining({
                method: 'GET'
            }));
            const json = await res.json();
            expect(json).toEqual(newsPayload);
        });

        test('POST /api/admin/news forwards route, method, content-type and exact JSON body', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const newsInput = {
                title: 'New Update 1.0',
                summary: 'Exciting new features',
                image_url: 'https://example.com/banner.png',
                target_url: 'https://example.com/update',
                published: true
            };

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ id: 'news-created-1', status: 'created' }), {
                    status: 201,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(newsInput)
            });

            expect(res.status).toBe(201);
            expect(capturedPath).toBe('/api/admin/news');
            expect(capturedOptions?.method).toBe('POST');
            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual(newsInput);

            const json = await res.json();
            expect(json).toEqual({ id: 'news-created-1', status: 'created' });
        });

        test('POST /api/admin/news preserves 400 validation error from worker', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'validation_error', details: ['invalid_title'] }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title: '' })
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'validation_error', details: ['invalid_title'] });
        });

        test('disallowed HTTP method on /api/admin/news does not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news', { method: 'PUT' });

            expect(res.status).toBe(404);
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        test('PATCH /api/admin/news/:id forwards route, PATCH method, content-type and partial body', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const patchInput = {
                title: 'Updated Title',
                published: false,
                summary: ''
            };

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news/news-1', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(patchInput)
            });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/news/news-1');
            expect(capturedOptions?.method).toBe('PATCH');
            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual(patchInput);

            const json = await res.json();
            expect(json).toEqual({ status: 'ok' });
        });

        test('PATCH /api/admin/news/:id preserves 400 validation error from worker', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'validation_error', details: ['summary_too_long'] }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news/news-1', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ summary: 'a'.repeat(1001) })
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'validation_error', details: ['summary_too_long'] });
        });

        test('PATCH /api/admin/news/:id preserves 404 not_found error from worker', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'not_found' }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news/news-nonexistent', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ title: 'New Title' })
            });

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json).toEqual({ error: 'not_found' });
        });

        test('DELETE /api/admin/news/:id forwards route, DELETE method without body and preserves 200 ok', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news/news-delete-1', { method: 'DELETE' });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/news/news-delete-1');
            expect(capturedOptions?.method).toBe('DELETE');
            const bodyBuffer = capturedOptions?.body as ArrayBuffer | undefined;
            expect(bodyBuffer ? bodyBuffer.byteLength : 0).toBe(0);

            const json = await res.json();
            expect(json).toEqual({ status: 'ok' });
        });

        test('DELETE /api/admin/news/:id preserves 404 not_found from worker', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'not_found' }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news/news-missing', { method: 'DELETE' });

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json).toEqual({ error: 'not_found' });
        });

        test('disallowed HTTP method on /api/admin/news/:id does not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/news/news-1', { method: 'POST' });

            expect(res.status).toBe(404);
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Worker Client Auth & Error Handling', () => {
        test('AdminWorkerClient throws ADMIN_AUTH_NOT_CONFIGURED when token is missing', async () => {
            const emptyProvider: CredentialProvider = { getToken: async () => null };
            const client = new AdminWorkerClient('http://worker', emptyProvider);
            await expect(client.fetch('/api/admin/releases')).rejects.toThrow('ADMIN_AUTH_NOT_CONFIGURED');
        });

        test('AdminWorkerClient sets cf-access-jwt-assertion header when token is present', async () => {
            const validProvider: CredentialProvider = { getToken: async () => 'jwt-test-token-123' };
            const client = new AdminWorkerClient('http://worker', validProvider);

            const originalFetch = global.fetch;
            const mockFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
            global.fetch = mockFetch;

            try {
                await client.fetch('/api/admin/releases');
                expect(mockFetch).toHaveBeenCalledTimes(1);
                const secondArg = mockFetch.mock.calls[0][1] as RequestInit;
                const headers = new Headers(secondArg.headers);
                expect(headers.get('cf-access-jwt-assertion')).toBe('jwt-test-token-123');
            } finally {
                global.fetch = originalFetch;
            }
        });

        test('AdminWorkerClient throws ADMIN_UNAUTHORIZED on 401 or 403 response', async () => {
            const validProvider: CredentialProvider = { getToken: async () => 'jwt-token' };
            const client = new AdminWorkerClient('http://worker', validProvider);

            const originalFetch = global.fetch;
            global.fetch = vi.fn()
                .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
                .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

            try {
                await expect(client.fetch('/api/admin/releases')).rejects.toThrow('ADMIN_UNAUTHORIZED');
                await expect(client.fetch('/api/admin/releases')).rejects.toThrow('ADMIN_UNAUTHORIZED');
            } finally {
                global.fetch = originalFetch;
            }
        });

        test('app handles ADMIN_AUTH_NOT_CONFIGURED error returning HTTP 401', async () => {
            const client = new AdminWorkerClient('http://worker', { getToken: async () => null });
            const app = createApp({ workerClient: client });

            const res = await app.request('/api/admin/releases', { method: 'GET' });
            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json).toEqual({ error: 'ADMIN_AUTH_NOT_CONFIGURED' });
        });

        test('app handles ADMIN_UNAUTHORIZED error returning HTTP 401', async () => {
            const client = new AdminWorkerClient('http://worker', { getToken: async () => 'bad-token' });
            vi.spyOn(client, 'fetch').mockRejectedValueOnce(new Error('ADMIN_UNAUTHORIZED'));

            const app = createApp({ workerClient: client });
            const res = await app.request('/api/admin/releases', { method: 'GET' });
            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json).toEqual({ error: 'ADMIN_UNAUTHORIZED' });
        });
    });

    describe('POST /api/local/file-inspect', () => {
        test('valid file returns filename, size, and deterministic SHA-256 hash', async () => {
            const app = createApp();
            const content = 'LauncherXD local file inspection deterministic test payload';
            const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
            const expectedSize = Buffer.byteLength(content);

            const formData = new FormData();
            const blob = new Blob([content], { type: 'text/plain' });
            formData.append('file', blob, 'minecraft-launcher-release.zip');

            const res = await app.request('/api/local/file-inspect', {
                method: 'POST',
                body: formData
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json).toEqual({
                filename: 'minecraft-launcher-release.zip',
                size: expectedSize,
                sha256: expectedHash
            });
            expect(json.sha256).toHaveLength(64);
            expect(json.sha256).toMatch(/^[0-9a-f]{64}$/);
        });

        test('request without file returns 400 Invalid file', async () => {
            const app = createApp();
            const formData = new FormData();
            formData.append('other_field', 'some_value');

            const res = await app.request('/api/local/file-inspect', {
                method: 'POST',
                body: formData
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'Invalid file' });
        });

        test('file larger than 50MB returns 400 without computing hash', async () => {
            const hasherSpy = vi.fn((buffer: Buffer) => crypto.createHash('sha256').update(buffer).digest('hex'));
            const app = createApp({ hasher: hasherSpy });

            const over50MbBuffer = new Uint8Array(51 * 1024 * 1024);
            const over50MbBlob = new Blob([over50MbBuffer], { type: 'application/octet-stream' });

            const formData = new FormData();
            formData.append('file', over50MbBlob, 'huge-file.bin');

            const res = await app.request('/api/local/file-inspect', {
                method: 'POST',
                body: formData
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'File too large for local inspect (max 50MB)' });
            expect(hasherSpy).not.toHaveBeenCalled();
        });
    });

    describe('Settings Proxy & Route Allowlist', () => {
        test('GET /api/admin/settings forwards route, GET method and preserves {value, Count}', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const mockSettings = [
                {
                    key: 'launcher_name',
                    value: 'LauncherXD',
                    value_type: 'string',
                    is_public: 1,
                    updated_at: '2026-08-20T12:00:00Z'
                },
                {
                    key: 'maintenance_mode',
                    value: 'false',
                    value_type: 'boolean',
                    is_public: 0,
                    updated_at: '2026-08-20T12:00:00Z'
                }
            ];

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ value: mockSettings, Count: 2 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/settings', { method: 'GET' });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/settings');
            expect(capturedOptions?.method).toBe('GET');
            const json = await res.json();
            expect(json).toEqual({ value: mockSettings, Count: 2 });
        });

        test('PUT /api/admin/settings/:key forwards route, PUT method, content-type and body, preserving status: ok', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const putInput = {
                value: 'LauncherXD',
                value_type: 'string',
                is_public: true
            };

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/settings/launcher_name', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(putInput)
            });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/settings/launcher_name');
            expect(capturedOptions?.method).toBe('PUT');
            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual(putInput);

            const json = await res.json();
            expect(json).toEqual({ status: 'ok' });
        });

        test('PUT /api/admin/settings/:key preserves percent-encoded key when forwarding to Worker', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const putInput = {
                value: 'custom_val',
                value_type: 'string'
            };

            let capturedPath: string | undefined;
            let capturedOptions: RequestInit | undefined;
            vi.spyOn(mockClient, 'fetch').mockImplementationOnce(async (path, options) => {
                capturedPath = path;
                capturedOptions = options;
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' }
                });
            });

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/settings/custom%2Fsetting%231', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(putInput)
            });

            expect(res.status).toBe(200);
            expect(capturedPath).toBe('/api/admin/settings/custom%2Fsetting%231');
            expect(capturedOptions?.method).toBe('PUT');
            const headers = new Headers(capturedOptions?.headers);
            expect(headers.get('content-type')).toBe('application/json');

            const receivedBody = capturedOptions?.body as ArrayBuffer | undefined;
            expect(receivedBody).toBeDefined();
            const decodedBody = Buffer.from(receivedBody!).toString('utf-8');
            expect(JSON.parse(decodedBody)).toEqual(putInput);

            const json = await res.json();
            expect(json).toEqual({ status: 'ok' });
        });

        test('PUT /api/admin/settings/:key preserves 400 validation error (invalid_or_unsafe_key)', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'validation_error', details: ['invalid_or_unsafe_key'] }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/settings/secret_key', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ value: 'val', value_type: 'string' })
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'validation_error', details: ['invalid_or_unsafe_key'] });
        });

        test('PUT /api/admin/settings/:key preserves 400 validation error (invalid_boolean_value)', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            vi.spyOn(mockClient, 'fetch').mockResolvedValueOnce(
                new Response(JSON.stringify({ error: 'validation_error', details: ['invalid_boolean_value'] }), {
                    status: 400,
                    headers: { 'content-type': 'application/json' }
                })
            );

            const app = createApp({ workerClient: mockClient });
            const res = await app.request('/api/admin/settings/feature_flag', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ value: 'yes', value_type: 'boolean' })
            });

            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json).toEqual({ error: 'validation_error', details: ['invalid_boolean_value'] });
        });

        test('disallowed HTTP methods on /api/admin/settings and /api/admin/settings/:key do not reach worker client', async () => {
            const mockClient = new AdminWorkerClient('http://mock-worker', { getToken: async () => 'tok' });
            const fetchSpy = vi.spyOn(mockClient, 'fetch');

            const app = createApp({ workerClient: mockClient });

            const resPost = await app.request('/api/admin/settings', { method: 'POST' });
            expect(resPost.status).toBe(404);

            const resGetParam = await app.request('/api/admin/settings/launcher_name', { method: 'GET' });
            expect(resGetParam.status).toBe(404);

            const resDeleteParam = await app.request('/api/admin/settings/launcher_name', { method: 'DELETE' });
            expect(resDeleteParam.status).toBe(404);

            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Local Credentials Endpoints (/api/local/credentials/*)', () => {
        test('GET /api/local/credentials/status returns boolean configured flags without exposing tokens', async () => {
            const mockStore = new (await import('../providers/windows-credentials')).MemoryCredentialStore();
            const app = createApp({ credentialStore: mockStore });

            const resEmpty = await app.request('/api/local/credentials/status');
            expect(resEmpty.status).toBe(200);
            expect(await resEmpty.json()).toEqual({
                admin: { configured: false },
                github: { configured: false }
            });

            await app.request('/api/local/credentials/admin', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'test-admin-secret-999' })
            });

            const resAdminOnly = await app.request('/api/local/credentials/status');
            expect(resAdminOnly.status).toBe(200);
            const dataAdmin = await resAdminOnly.json();
            expect(dataAdmin).toEqual({
                admin: { configured: true },
                github: { configured: false }
            });
            expect(JSON.stringify(dataAdmin)).not.toContain('test-admin-secret-999');
        });

        test('PUT /api/local/credentials/admin stores token and returns { configured: true } without leaking secret', async () => {
            const mockStore = new (await import('../providers/windows-credentials')).MemoryCredentialStore();
            const app = createApp({ credentialStore: mockStore });

            const res = await app.request('/api/local/credentials/admin', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'new-admin-token' })
            });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ configured: true });
            expect(await mockStore.get('LauncherXD/AdminApiToken')).toBe('new-admin-token');
        });

        test('PUT /api/local/credentials/admin rejects empty or non-string tokens', async () => {
            const mockStore = new (await import('../providers/windows-credentials')).MemoryCredentialStore();
            const app = createApp({ credentialStore: mockStore });

            const resEmpty = await app.request('/api/local/credentials/admin', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: '   ' })
            });
            expect(resEmpty.status).toBe(400);

            const resMissing = await app.request('/api/local/credentials/admin', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(resMissing.status).toBe(400);
        });

        test('PUT /api/local/credentials/github stores token and returns { configured: true }', async () => {
            const mockStore = new (await import('../providers/windows-credentials')).MemoryCredentialStore();
            const app = createApp({ credentialStore: mockStore });

            const res = await app.request('/api/local/credentials/github', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'new-github-pat' })
            });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ configured: true });
            expect(await mockStore.get('LauncherXD/GitHubToken')).toBe('new-github-pat');
        });

        test('DELETE /api/local/credentials/admin and /github removes credentials', async () => {
            const mockStore = new (await import('../providers/windows-credentials')).MemoryCredentialStore();
            const app = createApp({ credentialStore: mockStore });

            await app.request('/api/local/credentials/admin', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'tok-admin' })
            });
            await app.request('/api/local/credentials/github', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: 'tok-github' })
            });

            const delAdmin = await app.request('/api/local/credentials/admin', { method: 'DELETE' });
            expect(delAdmin.status).toBe(200);
            expect(await mockStore.get('LauncherXD/AdminApiToken')).toBeNull();

            const delGithub = await app.request('/api/local/credentials/github', { method: 'DELETE' });
            expect(delGithub.status).toBe(200);
            expect(await mockStore.get('LauncherXD/GitHubToken')).toBeNull();
        });
    });
});
