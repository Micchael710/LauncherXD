import { test, expect, describe, beforeEach } from 'vitest';
import {
    MemoryCredentialStore,
    CREDENTIAL_TARGET_ADMIN,
    CREDENTIAL_TARGET_GITHUB
} from '../providers/windows-credentials';

describe('Windows Credential Storage Provider', () => {
    let store: MemoryCredentialStore;

    beforeEach(() => {
        store = new MemoryCredentialStore();
    });

    test('1. returns null for non-existent target', async () => {
        const value = await store.get(CREDENTIAL_TARGET_ADMIN);
        expect(value).toBeNull();
    });

    test('2. stores and retrieves admin credential', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'admin-token-12345');
        const retrieved = await store.get(CREDENTIAL_TARGET_ADMIN);
        expect(retrieved).toBe('admin-token-12345');
    });

    test('3. stores and retrieves GitHub credential independently', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'admin-secret');
        await store.set(CREDENTIAL_TARGET_GITHUB, 'GitHubUser', 'github-secret');

        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('admin-secret');
        expect(await store.get(CREDENTIAL_TARGET_GITHUB)).toBe('github-secret');
    });

    test('4. replaces credential when set again', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'old-token');
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('old-token');

        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'new-token');
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('new-token');
    });

    test('5. deletes credential properly', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'token-to-delete');
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('token-to-delete');

        await store.delete(CREDENTIAL_TARGET_ADMIN);
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBeNull();
    });
});
