import { CredentialProvider, AuthHeaders } from '../providers/admin-auth-token';

export class AdminWorkerClient {
    constructor(private baseUrl: string, private provider: CredentialProvider) {}

    async fetch(path: string, options: RequestInit = {}) {
        let authHeaders: AuthHeaders | null = null;
        if (this.provider.getHeaders) {
            authHeaders = await this.provider.getHeaders();
        } else if (this.provider.getToken) {
            const token = await this.provider.getToken();
            if (token) {
                authHeaders = { 'cf-access-jwt-assertion': token };
            }
        }

        if (!authHeaders || Object.keys(authHeaders).length === 0) {
            throw new Error('ADMIN_AUTH_NOT_CONFIGURED');
        }

        const headers = new Headers(options.headers);
        for (const [k, v] of Object.entries(authHeaders)) {
            headers.set(k, v);
        }

        const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
        if (res.status === 401 || res.status === 403) throw new Error('ADMIN_UNAUTHORIZED');

        return res;
    }
}
