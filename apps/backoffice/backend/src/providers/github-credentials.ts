import { WindowsCredentialStore, getDefaultCredentialStore, CREDENTIAL_TARGET_GITHUB } from './windows-credentials';

export interface GitHubCredentialProvider {
    getToken(): Promise<string | null>;
}

export class EnvironmentGitHubCredentialProvider implements GitHubCredentialProvider {
    constructor(private store?: WindowsCredentialStore) {}

    private getStore(): WindowsCredentialStore {
        return this.store || getDefaultCredentialStore();
    }

    async getToken(): Promise<string | null> {
        const secureToken = await this.getStore().get(CREDENTIAL_TARGET_GITHUB);
        if (secureToken) {
            return secureToken;
        }

        return process.env.GITHUB_TOKEN || null;
    }
}
