import { test, expect, describe, beforeEach, vi } from 'vitest';
import {
    MemoryCredentialStore,
    NativeWindowsCredentialStore,
    WindowsPowerShellRunner,
    CREDENTIAL_TARGET_ADMIN,
    CREDENTIAL_TARGET_GITHUB
} from '../providers/windows-credentials';

describe('Windows Credential Storage Provider', () => {
    let store: MemoryCredentialStore;

    beforeEach(() => {
        store = new MemoryCredentialStore();
    });

    test('1. returns null for non-existent target in memory store', async () => {
        const value = await store.get(CREDENTIAL_TARGET_ADMIN);
        expect(value).toBeNull();
    });

    test('2. stores and retrieves admin credential in memory store', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'dummy-admin-token-123');
        const retrieved = await store.get(CREDENTIAL_TARGET_ADMIN);
        expect(retrieved).toBe('dummy-admin-token-123');
    });

    test('3. stores and retrieves GitHub credential independently in memory store', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'dummy-admin-secret');
        await store.set(CREDENTIAL_TARGET_GITHUB, 'GitHubUser', 'dummy-github-secret');

        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('dummy-admin-secret');
        expect(await store.get(CREDENTIAL_TARGET_GITHUB)).toBe('dummy-github-secret');
    });

    test('4. replaces credential when set again in memory store', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'dummy-old-token');
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('dummy-old-token');

        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'dummy-new-token');
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('dummy-new-token');
    });

    test('5. deletes credential properly in memory store', async () => {
        await store.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'dummy-token-to-delete');
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBe('dummy-token-to-delete');

        await store.delete(CREDENTIAL_TARGET_ADMIN);
        expect(await store.get(CREDENTIAL_TARGET_ADMIN)).toBeNull();
    });
});

describe('NativeWindowsCredentialStore Unit Tests (Mocked Runner)', () => {
    let mockRunner: WindowsPowerShellRunner;
    let runSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        runSpy = vi.fn();
        mockRunner = {
            run: runSpy
        };
    });

    test('A. set passes secret via STDIN and NOT in script or argv, then updates cache', async () => {
        const nativeStore = new NativeWindowsCredentialStore(mockRunner);
        runSpy.mockResolvedValueOnce('');

        const dummySecret = 'dummy-secret-payload-test';
        await nativeStore.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', dummySecret);

        expect(runSpy).toHaveBeenCalledTimes(1);
        const [script, stdin] = runSpy.mock.calls[0];

        // Verify secret does NOT appear in script text
        expect(script.includes(dummySecret)).toBe(false);
        // Verify base64 transport is sent through stdin
        const expectedBase64 = Buffer.from(dummySecret, 'utf8').toString('base64');
        expect(stdin).toBe(expectedBase64);

        // Verify cache now contains the secret
        const cached = await nativeStore.get(CREDENTIAL_TARGET_ADMIN);
        expect(cached).toBe(dummySecret);
        // Cache hit -> runner not called again for get
        expect(runSpy).toHaveBeenCalledTimes(1);
    });

    test('B. set failure throws error and does NOT update cache', async () => {
        const nativeStore = new NativeWindowsCredentialStore(mockRunner);
        runSpy.mockRejectedValueOnce(new Error('powershell failure'));

        await expect(
            nativeStore.set(CREDENTIAL_TARGET_ADMIN, 'AdminUser', 'secret-fail')
        ).rejects.toThrow('credential_store_write_failed');

        // Verify cache is still empty (next get attempts runner again)
        runSpy.mockResolvedValueOnce('retrieved-other\n');
        const retrieved = await nativeStore.get(CREDENTIAL_TARGET_ADMIN);
        expect(retrieved).toBe('retrieved-other');
    });

    test('C. get executes script and updates cache on success', async () => {
        const nativeStore = new NativeWindowsCredentialStore(mockRunner);
        runSpy.mockResolvedValueOnce('decrypted-secret-val\n');

        const result = await nativeStore.get(CREDENTIAL_TARGET_GITHUB);
        expect(result).toBe('decrypted-secret-val');
        expect(runSpy).toHaveBeenCalledTimes(1);

        // Next call hits cache
        const cached = await nativeStore.get(CREDENTIAL_TARGET_GITHUB);
        expect(cached).toBe('decrypted-secret-val');
        expect(runSpy).toHaveBeenCalledTimes(1);
    });

    test('D. delete success executes script and clears cache to null', async () => {
        const nativeStore = new NativeWindowsCredentialStore(mockRunner);
        // Prime cache
        nativeStore['cache'].set(CREDENTIAL_TARGET_ADMIN, 'dummy-active-token');

        runSpy.mockResolvedValueOnce('');
        await nativeStore.delete(CREDENTIAL_TARGET_ADMIN);

        expect(runSpy).toHaveBeenCalledTimes(1);
        // Cache is now null
        const afterDelete = await nativeStore.get(CREDENTIAL_TARGET_ADMIN);
        expect(afterDelete).toBeNull();
    });

    test('E. delete persistent failure throws error and preserves cached credential', async () => {
        const nativeStore = new NativeWindowsCredentialStore(mockRunner);
        // 1. Prime cache with active credential
        nativeStore['cache'].set(CREDENTIAL_TARGET_ADMIN, 'dummy-persisted-token');

        // 2. Mock delete runner to fail
        runSpy.mockRejectedValueOnce(new Error('Access Denied during Remove-Item'));

        // 3. delete() must reject
        await expect(nativeStore.delete(CREDENTIAL_TARGET_ADMIN)).rejects.toThrow(
            'credential_store_delete_failed'
        );

        // 4. Cached credential must remain available, not set to null
        const cachedAfterFailure = await nativeStore.get(CREDENTIAL_TARGET_ADMIN);
        expect(cachedAfterFailure).toBe('dummy-persisted-token');
    });
});
