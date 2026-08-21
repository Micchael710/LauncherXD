import { test, expect, vi, describe, beforeEach } from 'vitest';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { ApiClientError, formatApiErrorMessage } from '../api/client';
import type { CreateReleaseFileInput, UpdateReleaseFileInput, ReleaseFile } from '../types/releaseFiles';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ReleaseFilesApi Contracts & Error Handling', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    test('1. GET uses releaseId and returns { value, Count }', async () => {
        const mockFiles: ReleaseFile[] = [
            {
                id: 'file-1',
                release_id: 'rel-100',
                path: 'bin/launcher.jar',
                logical_path: 'bin/launcher.jar',
                filename: 'launcher.jar',
                operation: 'add',
                size: 2048,
                sha256: 'a'.repeat(64),
                created_at: '2026-08-20T00:00:00Z'
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ value: mockFiles, Count: 1 })
        });

        const res = await ReleaseFilesApi.listReleaseFiles('rel-100');

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-100/files', {});
        expect(res).toEqual({ value: mockFiles, Count: 1 });
    });

    test('2. POST uses exact method, route, headers, and body', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'file-created-1', status: 'created' })
        });

        const input: CreateReleaseFileInput = {
            path: 'mods/optifine.jar',
            logical_path: 'mods/optifine.jar',
            operation: 'add',
            size: 4096,
            sha256: 'b'.repeat(64),
            part_index: 1,
            part_count: 2,
            final_sha256: 'c'.repeat(64)
        };

        const res = await ReleaseFilesApi.createReleaseFile('rel-200', input);

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-200/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        expect(res).toEqual({ id: 'file-created-1', status: 'created' });
    });

    test('3. POST does not send filename', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'file-created-2', status: 'created' })
        });

        const input: CreateReleaseFileInput = {
            path: 'config/settings.json',
            logical_path: 'config/settings.json',
            operation: 'replace',
            size: 512,
            sha256: 'd'.repeat(64)
        };

        await ReleaseFilesApi.createReleaseFile('rel-300', input);

        const callArgs = mockFetch.mock.calls[0];
        const bodyObj = JSON.parse(callArgs[1].body as string);
        expect(bodyObj.filename).toBeUndefined();
        expect(bodyObj).toEqual({
            path: 'config/settings.json',
            logical_path: 'config/settings.json',
            operation: 'replace',
            size: 512,
            sha256: 'd'.repeat(64)
        });
    });

    test('4. PATCH uses both IDs and exact partial body', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const patchInput: UpdateReleaseFileInput = {
            operation: 'delete',
            size: 0
        };

        const res = await ReleaseFilesApi.updateReleaseFile('rel-400', 'file-400', patchInput);

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-400/files/file-400', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchInput)
        });
        expect(res).toEqual({ status: 'ok' });
    });

    test('5. DELETE uses both IDs', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const res = await ReleaseFilesApi.deleteReleaseFile('rel-500', 'file-500');

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/releases/rel-500/files/file-500', {
            method: 'DELETE'
        });
        expect(res).toEqual({ status: 'ok' });
    });

    test('6. 404 preserves not_found', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'not_found' })
        });

        try {
            await ReleaseFilesApi.listReleaseFiles('rel-missing');
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(404);
            expect(apiErr.error).toBe('not_found');
            expect(formatApiErrorMessage(apiErr)).toBe('Release not found.');
        }
    });

    test('7. 409 preserves release_not_draft', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: 'conflict',
                details: ['release_not_draft']
            })
        });

        try {
            await ReleaseFilesApi.createReleaseFile('rel-published', {
                path: 'a.jar',
                logical_path: 'a.jar',
                operation: 'add',
                size: 100,
                sha256: 'a'.repeat(64)
            });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(409);
            expect(apiErr.error).toBe('conflict');
            expect(apiErr.details).toEqual(['release_not_draft']);
            expect(formatApiErrorMessage(apiErr)).toBe('Release is not a draft.');
        }
    });

    test('8. 409 preserves duplicate_file_or_part', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: () => Promise.resolve({
                error: 'conflict',
                details: ['duplicate_file_or_part']
            })
        });

        try {
            await ReleaseFilesApi.createReleaseFile('rel-draft', {
                path: 'existing.jar',
                logical_path: 'existing.jar',
                operation: 'add',
                size: 100,
                sha256: 'e'.repeat(64)
            });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(409);
            expect(apiErr.error).toBe('conflict');
            expect(apiErr.details).toEqual(['duplicate_file_or_part']);
            expect(formatApiErrorMessage(apiErr)).toBe('A file or part with this path already exists.');
        }
    });

    test('9. 400 preserves full structured detail object', async () => {
        const structuredDetail = {
            code: 'invalid_sha256',
            path: 'mods/bad.jar',
            message: 'Must be 64 hexadecimal characters'
        };

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: [structuredDetail]
            })
        });

        try {
            await ReleaseFilesApi.createReleaseFile('rel-draft', {
                path: 'mods/bad.jar',
                logical_path: 'mods/bad.jar',
                operation: 'add',
                size: 100,
                sha256: 'bad-hash'
            });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(apiErr.error).toBe('validation_error');
            expect(apiErr.details).toEqual([structuredDetail]);
            expect(apiErr.details[0]).toEqual(structuredDetail);
        }
    });

    test('10. Formatter displays invalid_path with its path', () => {
        const err = new ApiClientError(400, 'validation_error', [
            { code: 'invalid_path', path: '../unsafe.jar' }
        ]);

        const formatted = formatApiErrorMessage(err);
        expect(formatted).toContain('Invalid path');
        expect(formatted).toContain('../unsafe.jar');
    });

    test('11. Formatter displays multipart_missing_part_index with path/message', () => {
        const err = new ApiClientError(400, 'validation_error', [
            { code: 'multipart_missing_part_index', path: 'client.jar', message: '2' }
        ]);

        const formatted = formatApiErrorMessage(err);
        expect(formatted).toContain('Missing multipart part index');
        expect(formatted).toContain('client.jar');
        expect(formatted).toContain('2');
    });
});
