import { GitHubCredentialProvider } from '../providers/github-credentials';

export interface GitHubUploadClientOptions {
    owner?: string;
    repo?: string;
    provider: GitHubCredentialProvider;
    baseUrl?: string;
}

export interface UploadedGitHubAsset {
    id: number;
    name: string;
    size: number;
    browser_download_url?: string;
    state?: string;
    label?: string;
}

export class GitHubUploadClient {
    private owner: string;
    private repo: string;
    private provider: GitHubCredentialProvider;
    private uploadBaseUrl: string;

    constructor(options: GitHubUploadClientOptions) {
        this.owner = options.owner || process.env.GITHUB_OWNER || 'Micchael710';
        this.repo = options.repo || process.env.GITHUB_RELEASES_REPO || 'LauncherXD-Releases';
        this.provider = options.provider;
        this.uploadBaseUrl = options.baseUrl || 'https://uploads.github.com';
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
}
