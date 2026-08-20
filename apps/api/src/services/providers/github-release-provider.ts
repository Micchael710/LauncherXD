import { ArtifactPublishingProvider, StorageAsset, StorageRelease } from './artifact-storage-provider';

export interface GitHubProviderConfig {
  owner: string;
  repo: string;
  token?: string;
}

export class GitHubReleaseProvider implements ArtifactPublishingProvider {
  private config: GitHubProviderConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubProviderConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'LauncherXD',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    return headers;
  }

  private async fetchApi(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}${path}`;
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: { ...this.getHeaders(), ...(options?.headers || {}) },
      body: options?.body
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('github_unauthorized');
      if (response.status === 403) throw new Error('github_forbidden');
      if (response.status === 404) throw new Error('github_not_found');
      if (response.status === 422) throw new Error('github_validation_failed');
      throw new Error('github_unavailable');
    }

    return response;
  }

  private async fetchUploadApi(releaseId: string, name: string, content: string | ArrayBuffer, contentType: string): Promise<Response> {
    const url = `https://uploads.github.com/repos/${this.config.owner}/${this.config.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': contentType
      },
      body: content as any
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('github_unauthorized');
      if (response.status === 403) throw new Error('github_forbidden');
      if (response.status === 404) throw new Error('github_not_found');
      if (response.status === 422) throw new Error('github_validation_failed');
      throw new Error('github_unavailable');
    }

    return response;
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.fetchApi('');
      return true;
    } catch (error: any) {
      if (error.message === 'github_unauthorized' || error.message === 'github_forbidden' || error.message === 'github_unavailable') {
        throw error;
      }
      // If we get github_not_found for the repo itself, it means the repo doesn't exist or is private without a valid token.
      if (error.message === 'github_not_found') {
        throw error;
      }
      throw new Error('github_unavailable');
    }
  }

  async getRelease(tag: string): Promise<StorageRelease | null> {
    try {
      const res = await this.fetchApi(`/releases/tags/${tag}`);
      let data: any;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('github_invalid_response');
      }

      if (!data || typeof data.id === 'undefined' || !data.tag_name) {
        throw new Error('github_invalid_response');
      }

      return {
        id: data.id.toString(),
        tag: data.tag_name,
        name: data.name ?? null,
        draft: Boolean(data.draft),
        prerelease: Boolean(data.prerelease),
        publishedAt: data.published_at ?? null
      };
    } catch (error: any) {
      if (error.message === 'github_not_found') {
        return null;
      }
      if (error.message === 'github_invalid_response') {
        throw error;
      }
      throw error;
    }
  }

  async listAssets(tag: string): Promise<StorageAsset[]> {
    try {
      const res = await this.fetchApi(`/releases/tags/${tag}`);
      let data: any;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('github_invalid_response');
      }

      if (!data || !Array.isArray(data.assets)) {
        throw new Error('github_invalid_response');
      }

      const assets: any[] = data.assets;
      return assets.map(a => {
        if (typeof a.id === 'undefined' || !a.name || typeof a.size === 'undefined' || !a.browser_download_url) {
          throw new Error('github_invalid_response');
        }
        return {
          id: a.id.toString(),
          name: a.name,
          size: a.size,
          downloadUrl: a.browser_download_url,
          contentType: a.content_type ?? null,
          state: a.state,
          digest: a.label
        };
      });
    } catch (error: any) {
      if (error.message === 'github_not_found') {
        return [];
      }
      if (error.message === 'github_invalid_response') {
        throw error;
      }
      throw error;
    }
  }

  async createDraftRelease(tag: string, name: string, notes: string, prerelease?: boolean): Promise<StorageRelease> {
    if (!this.config.token) throw new Error('github_write_unavailable');
    const res = await this.fetchApi('/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: name,
        body: notes,
        draft: true,
        prerelease: prerelease ?? false
      })
    });

    let data: any;
    try { data = await res.json(); } catch { throw new Error('github_invalid_response'); }

    if (!data || typeof data.id === 'undefined') throw new Error('github_invalid_response');

    return {
      id: data.id.toString(),
      tag: data.tag_name,
      name: data.name ?? null,
      draft: Boolean(data.draft),
      prerelease: Boolean(data.prerelease),
      publishedAt: data.published_at ?? null
    };
  }

  async updateRelease(releaseId: string, draft: boolean): Promise<void> {
    if (!this.config.token) throw new Error('github_write_unavailable');
    await this.fetchApi(`/releases/${releaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, make_latest: "false" })
    });
  }

  async uploadGeneratedAsset(releaseId: string, filename: string, content: string | ArrayBuffer, contentType: string): Promise<StorageAsset> {
    if (!this.config.token) throw new Error('github_write_unavailable');
    const res = await this.fetchUploadApi(releaseId, filename, content, contentType);

    let data: any;
    try { data = await res.json(); } catch { throw new Error('github_invalid_response'); }

    if (!data || typeof data.id === 'undefined') throw new Error('github_invalid_response');

    return {
      id: data.id.toString(),
      name: data.name,
      size: data.size,
      downloadUrl: data.browser_download_url,
      contentType: data.content_type ?? null
    };
  }

  async deleteGeneratedManifest(releaseId: string, assetId: string): Promise<void> {
    if (!this.config.token) throw new Error('github_write_unavailable');
    await this.fetchApi(`/releases/assets/${assetId}`, {
      method: 'DELETE'
    });
  }
}
