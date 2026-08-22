import { LocalApiClient } from './client';
import type {
    CreateReleaseInput,
    UpdateReleaseInput,
    Release,
    GitHubReleasePrepareResponse,
    GitHubReleaseStatusResponse,
    PublishReleaseResponse,
    DeleteEverywhereResponse
} from '../types/releases';
import type { ReleaseValidationResponse } from '../types/validation';

export const ReleasesApi = {
    async listReleases(): Promise<{ value: Release[]; Count: number }> {
        return LocalApiClient.fetch('/api/admin/releases');
    },
    async getRelease(id: string): Promise<Release> {
        return LocalApiClient.fetch(`/api/admin/releases/${id}`);
    },
    async createRelease(input: CreateReleaseInput): Promise<{ id: string }> {
        return LocalApiClient.fetch('/api/admin/releases', {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
        });
    },
    async updateRelease(id: string, input: UpdateReleaseInput): Promise<void> {
        await LocalApiClient.fetch(`/api/admin/releases/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
        });
    },
    async deleteRelease(id: string): Promise<void> {
        await LocalApiClient.fetch(`/api/admin/releases/${id}`, {
            method: 'DELETE'
        });
    },
    async validateRelease(id: string): Promise<ReleaseValidationResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${id}/validation`);
    },
    async prepareGitHubRelease(id: string): Promise<GitHubReleasePrepareResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${id}/github/prepare`, {
            method: 'POST'
        });
    },
    async getGitHubReleaseStatus(id: string): Promise<GitHubReleaseStatusResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${id}/github/status`);
    },
    async publishRelease(id: string, confirmVersion: string): Promise<PublishReleaseResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${id}/publish`, {
            method: 'POST',
            body: JSON.stringify({ confirm_version: confirmVersion }),
            headers: { 'Content-Type': 'application/json' }
        });
    },
    async deleteModpackEverywhere(id: string, confirmVersion: string, confirmPhrase: string = `DELETE ${confirmVersion}`): Promise<DeleteEverywhereResponse> {
        return LocalApiClient.fetch(`/api/local/releases/${id}/delete-everywhere`, {
            method: 'DELETE',
            body: JSON.stringify({ confirm_version: confirmVersion, confirm_phrase: confirmPhrase }),
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
