import { WindowsCredentialStore, getDefaultCredentialStore, CREDENTIAL_TARGET_ADMIN } from './windows-credentials';

export interface AuthHeaders {
    [key: string]: string;
}

export interface CredentialProvider {
    getToken?(): Promise<string | null>;
    getHeaders?(): Promise<AuthHeaders | null>;
}

export class EnvironmentCredentialProvider implements CredentialProvider {
    constructor(private store?: WindowsCredentialStore) {}

    private getStore(): WindowsCredentialStore {
        return this.store || getDefaultCredentialStore();
    }

    async getToken(): Promise<string | null> {
        const secureToken = await this.getStore().get(CREDENTIAL_TARGET_ADMIN);
        if (secureToken) {
            return secureToken;
        }

        return process.env.ADMIN_API_TOKEN || process.env.CF_ACCESS_TOKEN || null;
    }

    async getHeaders(): Promise<AuthHeaders | null> {
        const secureToken = await this.getStore().get(CREDENTIAL_TARGET_ADMIN);
        if (secureToken) {
            return {
                'Authorization': `Bearer ${secureToken}`
            };
        }

        const adminApiToken = process.env.ADMIN_API_TOKEN;
        if (adminApiToken) {
            return {
                'Authorization': `Bearer ${adminApiToken}`
            };
        }

        const clientId = process.env.CF_ACCESS_CLIENT_ID;
        const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
        if (clientId && clientSecret) {
            return {
                'CF-Access-Client-Id': clientId,
                'CF-Access-Client-Secret': clientSecret
            };
        }

        const token = process.env.CF_ACCESS_TOKEN;
        if (token) {
            return {
                'cf-access-jwt-assertion': token
            };
        }

        return null;
    }
}
