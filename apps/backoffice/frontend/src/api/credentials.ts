import { LocalApiClient } from './client';
import type { CredentialsStatusResponse, ConfigureCredentialResponse } from '../types/credentials';

export class CredentialsApi {
    static async getStatus(): Promise<CredentialsStatusResponse> {
        return LocalApiClient.fetch<CredentialsStatusResponse>('/api/local/credentials/status');
    }

    static async saveAdminToken(token: string): Promise<ConfigureCredentialResponse> {
        return LocalApiClient.fetch<ConfigureCredentialResponse>('/api/local/credentials/admin', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
    }

    static async saveGitHubToken(token: string): Promise<ConfigureCredentialResponse> {
        return LocalApiClient.fetch<ConfigureCredentialResponse>('/api/local/credentials/github', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
    }

    static async removeAdminToken(): Promise<ConfigureCredentialResponse> {
        return LocalApiClient.fetch<ConfigureCredentialResponse>('/api/local/credentials/admin', {
            method: 'DELETE'
        });
    }

    static async removeGitHubToken(): Promise<ConfigureCredentialResponse> {
        return LocalApiClient.fetch<ConfigureCredentialResponse>('/api/local/credentials/github', {
            method: 'DELETE'
        });
    }
}
