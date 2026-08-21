import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { EnvironmentCredentialProvider } from '../providers/admin-auth-token';
import { MemoryCredentialStore, CREDENTIAL_TARGET_ADMIN } from '../providers/windows-credentials';

describe('EnvironmentCredentialProvider with Secure Storage', () => {
    let originalEnvToken: string | undefined;
    let originalAdminApiToken: string | undefined;
    let originalClientId: string | undefined;
    let originalClientSecret: string | undefined;
    let mockStore: MemoryCredentialStore;

    beforeEach(() => {
        mockStore = new MemoryCredentialStore();
        originalEnvToken = process.env.CF_ACCESS_TOKEN;
        originalAdminApiToken = process.env.ADMIN_API_TOKEN;
        originalClientId = process.env.CF_ACCESS_CLIENT_ID;
        originalClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
    });

    afterEach(() => {
        if (originalEnvToken === undefined) delete process.env.CF_ACCESS_TOKEN;
        else process.env.CF_ACCESS_TOKEN = originalEnvToken;

        if (originalAdminApiToken === undefined) delete process.env.ADMIN_API_TOKEN;
        else process.env.ADMIN_API_TOKEN = originalAdminApiToken;

        if (originalClientId === undefined) delete process.env.CF_ACCESS_CLIENT_ID;
        else process.env.CF_ACCESS_CLIENT_ID = originalClientId;

        if (originalClientSecret === undefined) delete process.env.CF_ACCESS_CLIENT_SECRET;
        else process.env.CF_ACCESS_CLIENT_SECRET = originalClientSecret;
    });

    test('1. Secure stored credential takes precedence over environment variables', async () => {
        await mockStore.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'secure_stored_token');
        process.env.ADMIN_API_TOKEN = 'env_token';
        process.env.CF_ACCESS_TOKEN = 'cf_token';

        const provider = new EnvironmentCredentialProvider(mockStore);
        expect(await provider.getToken()).toBe('secure_stored_token');
        const headers = await provider.getHeaders();
        expect(headers).toEqual({
            'Authorization': 'Bearer secure_stored_token'
        });
    });

    test('2. Environment ADMIN_API_TOKEN is used as fallback when secure store is empty', async () => {
        delete process.env.CF_ACCESS_TOKEN;
        delete process.env.CF_ACCESS_CLIENT_ID;
        delete process.env.CF_ACCESS_CLIENT_SECRET;
        process.env.ADMIN_API_TOKEN = 'secret_local_admin_key_999';

        const provider = new EnvironmentCredentialProvider(mockStore);
        const headers = await provider.getHeaders();
        expect(headers).toEqual({
            'Authorization': 'Bearer secret_local_admin_key_999'
        });
        const token = await provider.getToken();
        expect(token).toBe('secret_local_admin_key_999');
    });

    test('3. ADMIN_API_TOKEN takes priority over Cloudflare Access credentials', async () => {
        process.env.ADMIN_API_TOKEN = 'primary_token';
        process.env.CF_ACCESS_CLIENT_ID = 'ignored_id';
        process.env.CF_ACCESS_CLIENT_SECRET = 'ignored_secret';
        process.env.CF_ACCESS_TOKEN = 'ignored_jwt';

        const provider = new EnvironmentCredentialProvider(mockStore);
        const headers = await provider.getHeaders();
        expect(headers).toEqual({
            'Authorization': 'Bearer primary_token'
        });
        expect(headers?.['CF-Access-Client-Id']).toBeUndefined();
        expect(headers?.['cf-access-jwt-assertion']).toBeUndefined();
    });

    test('4. gets token from env when CF_ACCESS_TOKEN is present', async () => {
        delete process.env.ADMIN_API_TOKEN;
        process.env.CF_ACCESS_TOKEN = 'test-token';
        const provider = new EnvironmentCredentialProvider(mockStore);
        const token = await provider.getToken();
        expect(token).toBe('test-token');
    });

    test('5. returns null when all auth storage and env vars are missing', async () => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.CF_ACCESS_TOKEN;
        delete process.env.CF_ACCESS_CLIENT_ID;
        delete process.env.CF_ACCESS_CLIENT_SECRET;
        const provider = new EnvironmentCredentialProvider(mockStore);
        const token = await provider.getToken();
        expect(token).toBeNull();
    });

    test('6. getHeaders returns CF-Access-Client-Id and CF-Access-Client-Secret when Service Token env vars are present', async () => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.CF_ACCESS_TOKEN;
        process.env.CF_ACCESS_CLIENT_ID = 'service-client-id';
        process.env.CF_ACCESS_CLIENT_SECRET = 'service-client-secret';
        const provider = new EnvironmentCredentialProvider(mockStore);
        const headers = await provider.getHeaders();
        expect(headers).toEqual({
            'CF-Access-Client-Id': 'service-client-id',
            'CF-Access-Client-Secret': 'service-client-secret'
        });
    });

    test('7. getHeaders returns cf-access-jwt-assertion when only CF_ACCESS_TOKEN is present', async () => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.CF_ACCESS_CLIENT_ID;
        delete process.env.CF_ACCESS_CLIENT_SECRET;
        process.env.CF_ACCESS_TOKEN = 'jwt-token-123';
        const provider = new EnvironmentCredentialProvider(mockStore);
        const headers = await provider.getHeaders();
        expect(headers).toEqual({
            'cf-access-jwt-assertion': 'jwt-token-123'
        });
    });

    test('8. getHeaders returns null when no auth env vars and no stored tokens', async () => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.CF_ACCESS_CLIENT_ID;
        delete process.env.CF_ACCESS_CLIENT_SECRET;
        delete process.env.CF_ACCESS_TOKEN;
        const provider = new EnvironmentCredentialProvider(mockStore);
        const headers = await provider.getHeaders();
        expect(headers).toBeNull();
    });
});
