import { test, expect, vi, describe, beforeEach } from 'vitest';
import { SettingsApi } from '../api/settings';
import { ApiClientError, formatApiErrorMessage, isSafeSettingKey } from '../api/client';
import { normalizeSettingItem } from '../types/settings';
import type { RawSettingItem, UpdateSettingInput } from '../types/settings';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SettingsApi Client & Validation Tests', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    test('listSettings performs GET to http://127.0.0.1:3000/api/admin/settings and normalizes is_public field', async () => {
        const rawItems: RawSettingItem[] = [
            {
                key: 'launcher_name',
                value: 'LauncherXD',
                value_type: 'string',
                is_public: 1, // D1 integer 1
                updated_at: '2026-08-20T10:00:00Z'
            },
            {
                key: 'maintenance_mode',
                value: 'false',
                value_type: 'boolean',
                is_public: 0, // D1 integer 0
                updated_at: '2026-08-20T11:00:00Z'
            },
            {
                key: 'max_memory',
                value: '4096',
                value_type: 'number',
                is_public: true, // boolean true
                updated_at: '2026-08-20T12:00:00Z'
            },
            {
                key: 'internal_flag',
                value: 'custom',
                value_type: 'string',
                is_public: false, // boolean false
                updated_at: '2026-08-20T13:00:00Z'
            }
        ];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ value: rawItems, Count: 4 })
        });

        const res = await SettingsApi.listSettings();

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/settings', {});
        expect(res.Count).toBe(4);
        expect(res.value).toHaveLength(4);

        expect(res.value[0].is_public).toBe(true);
        expect(res.value[1].is_public).toBe(false);
        expect(res.value[2].is_public).toBe(true);
        expect(res.value[3].is_public).toBe(false);
    });

    test('normalizeSettingItem helper maps truthy/falsy is_public numbers and booleans', () => {
        const raw1: RawSettingItem = { key: 'k1', value: 'v1', value_type: 'string', is_public: 1, updated_at: '' };
        const raw0: RawSettingItem = { key: 'k2', value: 'v2', value_type: 'string', is_public: 0, updated_at: '' };
        const rawTrue: RawSettingItem = { key: 'k3', value: 'v3', value_type: 'string', is_public: true, updated_at: '' };
        const rawFalse: RawSettingItem = { key: 'k4', value: 'v4', value_type: 'string', is_public: false, updated_at: '' };

        expect(normalizeSettingItem(raw1).is_public).toBe(true);
        expect(normalizeSettingItem(raw0).is_public).toBe(false);
        expect(normalizeSettingItem(rawTrue).is_public).toBe(true);
        expect(normalizeSettingItem(rawFalse).is_public).toBe(false);
    });

    test('upsertSetting performs PUT to http://127.0.0.1:3000/api/admin/settings/:key with exact payload and headers', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const input: UpdateSettingInput = {
            value: 'LauncherXD Official',
            value_type: 'string',
            is_public: true
        };

        const res = await SettingsApi.upsertSetting('launcher_name', input);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/settings/launcher_name', {
            method: 'PUT',
            body: JSON.stringify(input),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        expect(res).toEqual({ status: 'ok' });
    });

    test('upsertSetting uses encodeURIComponent for special characters in key', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        await SettingsApi.upsertSetting('custom/setting#1', {
            value: 'custom_val',
            value_type: 'string'
        });

        expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:3000/api/admin/settings/custom%2Fsetting%231', {
            method: 'PUT',
            body: JSON.stringify({ value: 'custom_val', value_type: 'string' }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    });

    test('upsertSetting preserves is_public: false as boolean in payload', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        await SettingsApi.upsertSetting('private_flag', {
            value: 'active',
            value_type: 'string',
            is_public: false
        });

        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({
            value: 'active',
            value_type: 'string',
            is_public: false
        });
        expect(parsedBody.is_public).toBe(false);
    });

    test('upsertSetting strictly whitelists properties and strips runtime extra properties', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok' })
        });

        const dirtyInput: unknown = {
            key: 'injected_key_in_body',
            value: 'cleaned_val',
            value_type: 'string',
            is_public: true,
            updated_at: '2026-08-20T00:00:00Z',
            unexpected_field: 'malicious_extra'
        };

        await SettingsApi.upsertSetting('clean_key', dirtyInput as UpdateSettingInput);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const callArgs = mockFetch.mock.calls[0];
        const requestOptions = callArgs[1] as RequestInit;
        const parsedBody = JSON.parse(requestOptions.body as string);

        expect(parsedBody).toEqual({
            value: 'cleaned_val',
            value_type: 'string',
            is_public: true
        });

        expect(parsedBody.key).toBeUndefined();
        expect(parsedBody.updated_at).toBeUndefined();
        expect(parsedBody.unexpected_field).toBeUndefined();
        expect(Object.keys(parsedBody).sort()).toEqual(['is_public', 'value', 'value_type'].sort());
    });

    test('upsertSetting handles 400 validation error (invalid_or_unsafe_key)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['invalid_or_unsafe_key']
            })
        });

        try {
            await SettingsApi.upsertSetting('github_token', { value: 'secret', value_type: 'string' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(apiErr.error).toBe('validation_error');
            expect(apiErr.details).toEqual(['invalid_or_unsafe_key']);
            expect(formatApiErrorMessage(apiErr, 'setting')).toBe(
                'Validation error: Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).'
            );
        }
    });

    test('upsertSetting handles 400 validation error (missing_required_fields)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['missing_required_fields']
            })
        });

        try {
            await SettingsApi.upsertSetting('key1', { value: '', value_type: '' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(formatApiErrorMessage(apiErr, 'setting')).toBe(
                'Validation error: Missing required fields (value and value_type are required).'
            );
        }
    });

    test('upsertSetting handles 400 validation error (invalid_boolean_value)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['invalid_boolean_value']
            })
        });

        try {
            await SettingsApi.upsertSetting('bool_flag', { value: 'yes', value_type: 'boolean' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(formatApiErrorMessage(apiErr, 'setting')).toBe(
                'Validation error: Invalid boolean value (must be exactly "true" or "false").'
            );
        }
    });

    test('upsertSetting handles 400 validation error (invalid_number_value)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({
                error: 'validation_error',
                details: ['invalid_number_value']
            })
        });

        try {
            await SettingsApi.upsertSetting('num_val', { value: 'abc', value_type: 'number' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(400);
            expect(formatApiErrorMessage(apiErr, 'setting')).toBe(
                'Validation error: Invalid number value (must be a valid number).'
            );
        }
    });

    test('listSettings handles 401 ADMIN_AUTH_NOT_CONFIGURED error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_AUTH_NOT_CONFIGURED' })
        });

        try {
            await SettingsApi.listSettings();
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(formatApiErrorMessage(apiErr, 'setting')).toBe('Admin authentication is not configured.');
        }
    });

    test('upsertSetting handles 401 ADMIN_UNAUTHORIZED error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'ADMIN_UNAUTHORIZED' })
        });

        try {
            await SettingsApi.upsertSetting('key1', { value: 'val', value_type: 'string' });
            expect.unreachable('Should have thrown ApiClientError');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ApiClientError);
            const apiErr = err as ApiClientError;
            expect(apiErr.status).toBe(401);
            expect(formatApiErrorMessage(apiErr, 'setting')).toBe('Admin unauthorized (invalid or missing credentials).');
        }
    });

    describe('isSafeSettingKey local validation utility', () => {
        test('allows valid, safe setting keys', () => {
            expect(isSafeSettingKey('launcher_name')).toBe(true);
            expect(isSafeSettingKey('theme')).toBe(true);
            expect(isSafeSettingKey('max_memory')).toBe(true);
            expect(isSafeSettingKey('download_threads')).toBe(true);
            expect(isSafeSettingKey('server_ip')).toBe(true);
            expect(isSafeSettingKey('custom_setting_123')).toBe(true);
        });

        test('rejects empty or whitespace keys', () => {
            expect(isSafeSettingKey('')).toBe(false);
            expect(isSafeSettingKey('   ')).toBe(false);
            expect(isSafeSettingKey(undefined)).toBe(false);
            expect(isSafeSettingKey(null)).toBe(false);
        });

        test('rejects keys starting with cloudflare_access_ in any case', () => {
            expect(isSafeSettingKey('cloudflare_access_aud')).toBe(false);
            expect(isSafeSettingKey('CLOUDFLARE_ACCESS_KEY')).toBe(false);
            expect(isSafeSettingKey('Cloudflare_Access_cert')).toBe(false);
        });

        test('rejects keys starting with github_ in any case', () => {
            expect(isSafeSettingKey('github_client_id')).toBe(false);
            expect(isSafeSettingKey('GITHUB_APP_ID')).toBe(false);
            expect(isSafeSettingKey('Github_repo')).toBe(false);
        });

        test('rejects keys containing sensitive blacklist words in any casing', () => {
            expect(isSafeSettingKey('my_github_token')).toBe(false);
            expect(isSafeSettingKey('access_token')).toBe(false);
            expect(isSafeSettingKey('USER_TOKEN_VAL')).toBe(false);
            expect(isSafeSettingKey('admin_password')).toBe(false);
            expect(isSafeSettingKey('SECRET_KEY')).toBe(false);
            expect(isSafeSettingKey('jwt_signing_key')).toBe(false);
            expect(isSafeSettingKey('bearer_auth')).toBe(false);
            expect(isSafeSettingKey('AUTHORIZATION_HEADER')).toBe(false);
            expect(isSafeSettingKey('api_key_public')).toBe(false);
            expect(isSafeSettingKey('server_private_key')).toBe(false);
            expect(isSafeSettingKey('credential_store')).toBe(false);
        });
    });
});
