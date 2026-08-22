import { GitHubCredentialProvider } from '../providers/github-credentials';

export interface GitHubUploadClientOptions {
    owner?: string;
    repo?: string;
    provider: GitHubCredentialProvider;
    baseUrl?: string;
    apiBaseUrl?: string;
}

export interface UploadedGitHubAsset {
    id: number;
    name: string;
    size: number;
    browser_download_url?: string;
    state?: string;
    label?: string;
}

export interface GitHubReleaseSummary {
    id: number;
    tag_name: string;
    name?: string;
    draft?: boolean;
    prerelease?: boolean;
}

export type GitHubDeletionResult = 'deleted' | 'not_present';

export class GitHubUploadClient {
    private owner: string;
    private repo: string;
    private provider: GitHubCredentialProvider;
    private uploadBaseUrl: string;
    private apiBaseUrl: string;

    constructor(options: GitHubUploadClientOptions) {
        this.owner = options.owner || process.env.GITHUB_OWNER || 'Micchael710';
        this.repo = options.repo || process.env.GITHUB_RELEASES_REPO || 'LauncherXD-Releases';
        this.provider = options.provider;
        this.uploadBaseUrl = options.baseUrl || 'https://uploads.github.com';
        this.apiBaseUrl = options.apiBaseUrl || 'https://api.github.com';
    }

    async uploadAsset(
        githubReleaseId: number | string,
        assetName: string,
        label: string,
        content: Buffer | ArrayBuffer | Uint8Array | string,
        contentType = 'application/octet-stream'
    ): Promise<UploadedGitHubAsset> {
        const token = await this.provider.getToken();
        if (!token) {
            throw new Error('GITHUB_AUTH_NOT_CONFIGURED');
        }

        const url = `${this.uploadBaseUrl}/repos/${this.owner}/${this.repo}/releases/${githubReleaseId}/assets?name=${encodeURIComponent(assetName)}&label=${encodeURIComponent(label)}`;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': contentType
        };

        let bodyData: BodyInit;
        if (typeof content === 'string') {
            bodyData = new Blob([content]);
        } else if (content instanceof ArrayBuffer) {
            bodyData = new Blob([content]);
        } else {
            const copy = new Uint8Array(content.byteLength);
            copy.set(content);
            bodyData = new Blob([copy.buffer]);
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: bodyData
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error('GITHUB_UNAUTHORIZED');
            if (res.status === 403) throw new Error('GITHUB_FORBIDDEN');
            if (res.status === 404) throw new Error('GITHUB_NOT_FOUND');
            if (res.status === 422) throw new Error('GITHUB_ASSET_CONFLICT');
            throw new Error('GITHUB_UNAVAILABLE');
        }

        const data = (await res.json()) as UploadedGitHubAsset;
        return data;
    }

    async getReleaseByTag(tag: string): Promise<GitHubReleaseSummary | null> {
        const token = await this.provider.getToken();
        if (!token) {
            throw new Error('GITHUB_AUTH_NOT_CONFIGURED');
        }

        const cleanTag = tag.startsWith('tags/') ? tag.slice(5) : tag;
        const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/tags/${encodeURIComponent(cleanTag)}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        if (res.status === 404) {
            return null;
        }

        if (!res.ok) {
            if (res.status === 401) throw new Error('GITHUB_UNAUTHORIZED');
            if (res.status === 403) throw new Error('GITHUB_FORBIDDEN');
            throw new Error('GITHUB_UNAVAILABLE');
        }

        const data = (await res.json()) as GitHubReleaseSummary;
        if (data.tag_name !== cleanTag) {
            return null;
        }
        return data;
    }

    async deleteRelease(githubReleaseId: number | string): Promise<GitHubDeletionResult> {
        const token = await this.provider.getToken();
        if (!token) {
            throw new Error('GITHUB_AUTH_NOT_CONFIGURED');
        }

        const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/${githubReleaseId}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        const res = await fetch(url, {
            method: 'DELETE',
            headers
        });

        if (res.status === 204) {
            return 'deleted';
        }

        if (res.status === 404) {
            return 'not_present';
        }

        if (res.status === 401) throw new Error('GITHUB_UNAUTHORIZED');
        if (res.status === 403) throw new Error('GITHUB_FORBIDDEN');
        throw new Error('GITHUB_UNAVAILABLE');
    }

    async deleteTagIfExists(githubTag: string): Promise<GitHubDeletionResult> {
        const token = await this.provider.getToken();
        if (!token) {
            throw new Error('GITHUB_AUTH_NOT_CONFIGURED');
        }

        const cleanTag = githubTag.startsWith('tags/') ? githubTag.slice(5) : githubTag;
        const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/git/refs/tags/${encodeURIComponent(cleanTag)}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        const res = await fetch(url, {
            method: 'DELETE',
            headers
        });

        if (res.status === 204) {
            return 'deleted';
        }

        if (res.status === 404 || res.status === 422) {
            return 'not_present';
        }

        if (res.status === 401) throw new Error('GITHUB_UNAUTHORIZED');
        if (res.status === 403) throw new Error('GITHUB_FORBIDDEN');
        throw new Error('GITHUB_UNAVAILABLE');
    }
}
