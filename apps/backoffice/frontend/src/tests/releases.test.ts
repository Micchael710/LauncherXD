import { test, expect, vi, describe, beforeEach } from 'vitest';
import { ReleasesApi } from '../api/releases';
import { ApiClientError, formatApiErrorMessage } from '../api/client';
import type { CreateReleaseInput, UpdateReleaseInput } from '../types/releases';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReleasesApi & Error Handling', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    test('listReleases calls GET /api/admin/releases', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ value: [], Count: 0 })
        });
        const res = await ReleasesApi.listReleases();
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases', {});
        expect(res.value).toEqual([]);
    });

    test('getRelease calls GET /api/admin/releases/:id', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 'rel-1', version: '1.0.0', channel: 'stable', release_type: 'launcher', status: 'draft' })
        });
        const res = await ReleasesApi.getRelease('rel-1');
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-1', {});
        expect(res.id).toBe('rel-1');
        expect(res.version).toBe('1.0.0');
    });

    test('createRelease POSTs input to backend', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'rel-new' })
        });

        const input: CreateReleaseInput = { version: '1.0.0', channel: 'stable', release_type: 'launcher' };
        const res = await ReleasesApi.createRelease(input);

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        expect(res.id).toBe('rel-new');
    });

    test('updateRelease PATCHes to correct id', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const input: UpdateReleaseInput = { channel: 'beta' };
        await ReleasesApi.updateRelease('rel-1', input);

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
    });

    test('deleteRelease DELETEs correct id', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });
        await ReleasesApi.deleteRelease('rel-1');
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-1', {
            method: 'DELETE'
        });
    });

    test('400 validation_error preserves details and status', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['invalid_version', 'invalid_channel']
            })
        });

        try {
            await ReleasesApi.createRelease({ version: 'invalid', channel: 'stable', release_type: 'launcher' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(apiErr.error).toBe('validation_error');
            expect(apiErr.details).toEqual(['invalid_version', 'invalid_channel']);
            expect(formatApiErrorMessage(apiErr)).toContain('Invalid SemVer version');
            expect(formatApiErrorMessage(apiErr)).toContain('Invalid channel');
        }
    });

    test('409 duplicate_release conflict mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: 'conflict',
                details: ['duplicate_release']
            })
        });

        try {
            await ReleasesApi.createRelease({ version: '1.0.0', channel: 'stable', release_type: 'launcher' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(409);
            expect(apiErr.error).toBe('conflict');
            expect(apiErr.details).toEqual(['duplicate_release']);
            expect(formatApiErrorMessage(apiErr)).toBe('A release with this version already exists.');
        }
    });

    test('409 cannot_edit_published conflict mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: 'conflict',
                details: ['cannot_edit_published']
            })
        });

        try {
            await ReleasesApi.updateRelease('rel-1', { channel: 'beta' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(409);
            expect(apiErr.details).toEqual(['cannot_edit_published']);
            expect(formatApiErrorMessage(apiErr)).toBe('Cannot edit a published release.');
        }
    });

    test('409 cannot_edit_deprecated conflict mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: 'conflict',
                details: ['cannot_edit_deprecated']
            })
        });

        try {
            await ReleasesApi.updateRelease('rel-1', { channel: 'beta' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(409);
            expect(apiErr.details).toEqual(['cannot_edit_deprecated']);
            expect(formatApiErrorMessage(apiErr)).toBe('Cannot edit a deprecated release.');
        }
    });

    test('409 only_drafts_can_be_deleted conflict mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: 'conflict',
                details: ['only_drafts_can_be_deleted']
            })
        });

        try {
            await ReleasesApi.deleteRelease('rel-1');
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(409);
            expect(apiErr.details).toEqual(['only_drafts_can_be_deleted']);
            expect(formatApiErrorMessage(apiErr)).toBe('Only draft releases can be deleted.');
        }
    });

    test('404 not_found error mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'not_found' })
        });

        try {
            await ReleasesApi.getRelease('non-existent');
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(404);
            expect(apiErr.error).toBe('not_found');
            expect(formatApiErrorMessage(apiErr)).toBe('Release not found.');
        }
    });

    test('ADMIN_AUTH_NOT_CONFIGURED error mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_AUTH_NOT_CONFIGURED' })
        });

        try {
            await ReleasesApi.listReleases();
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(apiErr.error).toBe('ADMIN_AUTH_NOT_CONFIGURED');
            expect(formatApiErrorMessage(apiErr)).toBe('Admin authentication is not configured.');
        }
    });

    test('ADMIN_UNAUTHORIZED error mapping', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_UNAUTHORIZED' })
        });

        try {
            await ReleasesApi.listReleases();
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(apiErr.error).toBe('ADMIN_UNAUTHORIZED');
            expect(formatApiErrorMessage(apiErr)).toBe('Admin unauthorized (invalid or missing credentials).');
        }
    });

    test('validateRelease performs GET to /api/admin/releases/:id/validation and returns valid response', async () => {
        const expectedResponse = { valid: true, issues: [] };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(expectedResponse)
        });

        const result = await ReleasesApi.validateRelease('rel-1');

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-1/validation', {});
        expect(result).toEqual(expectedResponse);
        expect(result.valid).toBe(true);
        expect(result.issues).toEqual([]);
    });

    test('validateRelease preserves code, path, and message for invalid release readiness', async () => {
        const expectedIssues = [
            { code: 'multipart_missing_part', path: 'bin/pack.zip', message: 'Missing part 2' },
            { code: 'invalid_total_size', message: 'Total size mismatch' }
        ];
        const expectedResponse = { valid: false, issues: expectedIssues };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(expectedResponse)
        });

        const result = await ReleasesApi.validateRelease('rel-2');

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-2/validation', {});
        expect(result.valid).toBe(false);
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]).toEqual({
            code: 'multipart_missing_part',
            path: 'bin/pack.zip',
            message: 'Missing part 2'
        });
        expect(result.issues[1]).toEqual({
            code: 'invalid_total_size',
            message: 'Total size mismatch'
        });
    });

    test('validateRelease throws ApiClientError on 404 not_found', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'not_found' })
        });

        try {
            await ReleasesApi.validateRelease('rel-missing');
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(404);
            expect(apiErr.error).toBe('not_found');
            expect(formatApiErrorMessage(apiErr)).toBe('Release not found.');
        }
    });
});
