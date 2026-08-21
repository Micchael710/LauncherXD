import { test, expect, vi, describe, beforeEach } from 'vitest';
import { NewsApi } from '../api/news';
import { ApiClientError, formatApiErrorMessage } from '../api/client';
import { normalizeNewsItem } from '../types/news';
import type { CreateNewsInput, UpdateNewsInput, RawNewsItem } from '../types/news';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NewsApi Client & Normalization Tests', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    test('listNews performs GET to http://127.0.0.1:3000/api/admin/news and normalizes published field', async () => {
        const rawItems: RawNewsItem[] = [
            {
                id: 'news-1',
                title: 'First News',
                summary: 'Short summary',
                image_url: 'https://example.com/img1.png',
                target_url: 'https://example.com/target1',
                published: 1, // D1 integer 1
                published_at: '2026-08-20T10:00:00Z',
                created_at: '2026-08-20T09:00:00Z',
                updated_at: '2026-08-20T09:00:00Z'
            },
            {
                id: 'news-2',
                title: 'Draft News',
                summary: null,
                image_url: null,
                target_url: null,
                published: 0, // D1 integer 0
                published_at: null,
                created_at: '2026-08-20T11:00:00Z',
                updated_at: '2026-08-20T11:00:00Z'
            },
            {
                id: 'news-3',
                title: 'Boolean Published News',
                published: true,
                created_at: '2026-08-20T12:00:00Z',
                updated_at: '2026-08-20T12:00:00Z'
            },
            {
                id: 'news-4',
                title: 'Boolean Draft News',
                published: false,
                created_at: '2026-08-20T13:00:00Z',
                updated_at: '2026-08-20T13:00:00Z'
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ value: rawItems, Count: 4 })
        });

        const res = await NewsApi.listNews();

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/news', {});
        expect(res.Count).toBe(4);
        expect(res.value).toHaveLength(4);

        expect(res.value[0].published).toBe(true);
        expect(res.value[1].published).toBe(false);
        expect(res.value[2].published).toBe(true);
        expect(res.value[3].published).toBe(false);
    });

    test('normalizeNewsItem helper maps truthy/falsy published numbers and booleans', () => {
        const raw1: RawNewsItem = { id: '1', title: 'A', published: 1, created_at: '', updated_at: '' };
        const raw0: RawNewsItem = { id: '2', title: 'B', published: 0, created_at: '', updated_at: '' };
        const rawTrue: RawNewsItem = { id: '3', title: 'C', published: true, created_at: '', updated_at: '' };
        const rawFalse: RawNewsItem = { id: '4', title: 'D', published: false, created_at: '', updated_at: '' };

        expect(normalizeNewsItem(raw1).published).toBe(true);
        expect(normalizeNewsItem(raw0).published).toBe(false);
        expect(normalizeNewsItem(rawTrue).published).toBe(true);
        expect(normalizeNewsItem(rawFalse).published).toBe(false);
    });

    test('createNews performs POST to http://127.0.0.1:3000/api/admin/news with exact payload and headers', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'news-created-123', status: 'created' })
        });

        const input: CreateNewsInput = {
            title: 'Summer Festival Event',
            summary: 'Join our special server event this weekend!',
            image_url: 'https://cdn.example.com/summer.png',
            target_url: 'https://minecraft.example.com/events/summer',
            published: true
        };

        const res = await NewsApi.createNews(input);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/news', {
            method: 'POST',
            body: JSON.stringify(input),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        expect(res).toEqual({ id: 'news-created-123', status: 'created' });
    });

    test('createNews strictly whitelists allowed properties and strips runtime extra properties', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: 'news-whitelisted-1', status: 'created' })
        });

        const dirtyInput: unknown = {
            title: 'Valid News Title',
            summary: 'Valid summary text',
            image_url: 'https://example.com/image.png',
            target_url: 'https://example.com/target',
            published: true,
            id: 'injected-id',
            published_at: '2026-08-20T00:00:00Z',
            created_at: '2026-08-20T00:00:00Z',
            updated_at: '2026-08-20T00:00:00Z',
            unexpected_field: 'malicious_or_extra_value'
        };

        await NewsApi.createNews(dirtyInput as CreateNewsInput);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({
            title: 'Valid News Title',
            summary: 'Valid summary text',
            image_url: 'https://example.com/image.png',
            target_url: 'https://example.com/target',
            published: true
        });

        expect(parsedBody.id).toBeUndefined();
        expect(parsedBody.published_at).toBeUndefined();
        expect(parsedBody.created_at).toBeUndefined();
        expect(parsedBody.updated_at).toBeUndefined();
        expect(parsedBody.unexpected_field).toBeUndefined();
        expect(Object.keys(parsedBody).sort()).toEqual(['image_url', 'published', 'summary', 'target_url', 'title'].sort());
    });

    test('createNews handles 400 validation error (invalid_title)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['invalid_title']
            })
        });

        try {
            await NewsApi.createNews({ title: '' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(apiErr.error).toBe('validation_error');
            expect(apiErr.details).toEqual(['invalid_title']);
            expect(formatApiErrorMessage(apiErr)).toBe('Validation error: Invalid title (must be non-empty and max 200 characters).');
        }
    });

    test('createNews handles 400 validation error (summary_too_long)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['summary_too_long']
            })
        });

        try {
            await NewsApi.createNews({ title: 'Title', summary: 'a'.repeat(1001) });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(formatApiErrorMessage(apiErr)).toBe('Validation error: Summary is too long (max 1,000 characters).');
        }
    });

    test('createNews handles 400 validation error (invalid_image_url and invalid_target_url)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['invalid_image_url', 'invalid_target_url']
            })
        });

        try {
            await NewsApi.createNews({
                title: 'Title',
                image_url: 'javascript:alert(1)',
                target_url: 'ftp://bad'
            });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(formatApiErrorMessage(apiErr)).toBe(
                'Validation error: Invalid image URL (must be an absolute http: or https: URL)., Invalid target URL (must be an absolute http: or https: URL).'
            );
        }
    });

    test('listNews handles 401 ADMIN_AUTH_NOT_CONFIGURED error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_AUTH_NOT_CONFIGURED' })
        });

        try {
            await NewsApi.listNews();
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(apiErr.error).toBe('ADMIN_AUTH_NOT_CONFIGURED');
            expect(formatApiErrorMessage(apiErr)).toBe('Admin authentication is not configured.');
        }
    });

    test('createNews handles 401 ADMIN_UNAUTHORIZED error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_UNAUTHORIZED' })
        });

        try {
            await NewsApi.createNews({ title: 'New News' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(apiErr.error).toBe('ADMIN_UNAUTHORIZED');
            expect(formatApiErrorMessage(apiErr)).toBe('Admin unauthorized (invalid or missing credentials).');
        }
    });

    test('updateNews performs PATCH to http://127.0.0.1:3000/api/admin/news/:id with partial payload and returns ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const res = await NewsApi.updateNews('news-1', {
            title: 'Updated Title',
            summary: 'Updated Summary'
        });

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/news/news-1', {
            method: 'PATCH',
            body: JSON.stringify({ title: 'Updated Title', summary: 'Updated Summary' }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        expect(res).toEqual({ status: 'ok' });
    });

    test('updateNews sending only title sends exact partial payload without other keys', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        await NewsApi.updateNews('news-2', { title: 'Only Title Changed' });

        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({ title: 'Only Title Changed' });
        expect(Object.keys(parsedBody)).toEqual(['title']);
    });

    test('updateNews sending only published: false preserves boolean false without converting to undefined', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        await NewsApi.updateNews('news-3', { published: false });

        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({ published: false });
        expect(Object.keys(parsedBody)).toEqual(['published']);
    });

    test('updateNews preserves empty strings for clearing optional fields', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        await NewsApi.updateNews('news-4', {
            summary: '',
            image_url: '',
            target_url: ''
        });

        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({
            summary: '',
            image_url: '',
            target_url: ''
        });
    });

    test('updateNews strictly whitelists properties and strips runtime extra properties', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const dirtyInput: unknown = {
            title: 'Clean Title',
            summary: 'Clean Summary',
            image_url: 'https://example.com/image.png',
            target_url: 'https://example.com/target',
            published: true,
            id: 'injected-id',
            published_at: '2026-08-20T00:00:00Z',
            created_at: '2026-08-20T00:00:00Z',
            updated_at: '2026-08-20T00:00:00Z',
            unexpected_field: 'malicious_extra'
        };

        await NewsApi.updateNews('news-5', dirtyInput as UpdateNewsInput);

        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({
            title: 'Clean Title',
            summary: 'Clean Summary',
            image_url: 'https://example.com/image.png',
            target_url: 'https://example.com/target',
            published: true
        });
        expect(parsedBody.id).toBeUndefined();
        expect(parsedBody.published_at).toBeUndefined();
        expect(parsedBody.created_at).toBeUndefined();
        expect(parsedBody.updated_at).toBeUndefined();
        expect(parsedBody.unexpected_field).toBeUndefined();
    });

    test('updateNews handles 400 validation error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['summary_too_long']
            })
        });

        try {
            await NewsApi.updateNews('news-6', { summary: 's'.repeat(1001) });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(formatApiErrorMessage(apiErr, 'news')).toBe('Validation error: Summary is too long (max 1,000 characters).');
        }
    });

    test('updateNews handles 401 error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_UNAUTHORIZED' })
        });

        try {
            await NewsApi.updateNews('news-7', { title: 'New' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(formatApiErrorMessage(apiErr, 'news')).toBe('Admin unauthorized (invalid or missing credentials).');
        }
    });

    test('updateNews handles 404 not_found error with news context', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'not_found' })
        });

        try {
            await NewsApi.updateNews('news-nonexistent', { title: 'New' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(404);
            expect(apiErr.error).toBe('not_found');
            expect(formatApiErrorMessage(apiErr, 'news')).toBe('News item not found.');
        }
    });

    test('deleteNews performs DELETE to http://127.0.0.1:3000/api/admin/news/:id without body and returns ok', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const res = await NewsApi.deleteNews('news-del-1');

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/news/news-del-1', {
            method: 'DELETE'
        });
        expect(res).toEqual({ status: 'ok' });
    });

    test('deleteNews handles 401 ADMIN_AUTH_NOT_CONFIGURED error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_AUTH_NOT_CONFIGURED' })
        });

        try {
            await NewsApi.deleteNews('news-del-2');
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(formatApiErrorMessage(apiErr, 'news')).toBe('Admin authentication is not configured.');
        }
    });

    test('deleteNews handles 404 not_found error with news context', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'not_found' })
        });

        try {
            await NewsApi.deleteNews('news-missing');
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(404);
            expect(formatApiErrorMessage(apiErr, 'news')).toBe('News item not found.');
        }
    });
});
