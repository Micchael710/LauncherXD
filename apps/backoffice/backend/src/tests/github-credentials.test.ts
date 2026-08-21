import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { EnvironmentGitHubCredentialProvider } from '../providers/github-credentials';
import { MemoryCredentialStore, CREDENTIAL_TARGET_GITHUB } from '../providers/windows-credentials';

describe('EnvironmentGitHubCredentialProvider with Secure Storage', () => {
    let originalToken: string | undefined;
    let mockStore: MemoryCredentialStore;

    beforeEach(() => {
        mockStore = new MemoryCredentialStore();
        originalToken = process.env.GITHUB_TOKEN;
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.GITHUB_TOKEN;
        } else {
            process.env.GITHUB_TOKEN = originalToken;
        }
    });

    test('1. returns secure stored token over environment variable', async () => {
        await mockStore.set(CREDENTIAL_TARGET_GITHUB, 'GitHubUser', 'secure_gh_token_999');
        process.env.GITHUB_TOKEN = 'env_gh_token';

        const provider = new EnvironmentGitHubCredentialProvider(mockStore);
        const token = await provider.getToken();
        expect(token).toBe('secure_gh_token_999');
    });

    test('2. returns env token when secure store has no token', async () => {
        process.env.GITHUB_TOKEN = 'ghp_secret_token_123';
        const provider = new EnvironmentGitHubCredentialProvider(mockStore);
        const token = await provider.getToken();
        expect(token).toBe('ghp_secret_token_123');
    });

    test('3. returns null when both secure store and GITHUB_TOKEN are missing', async () => {
        delete process.env.GITHUB_TOKEN;
        const provider = new EnvironmentGitHubCredentialProvider(mockStore);
        const token = await provider.getToken();
        expect(token).toBeNull();
    });
});
