import { ArtifactStorageProvider, StorageAsset, StorageRelease } from './artifact-storage-provider';

export interface GitHubProviderConfig {
  owner: string;
  repo: string;
  token?: string;
}

export class GitHubReleaseProvider implements ArtifactStorageProvider {
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

  private async fetchApi(path: string): Promise<Response> {
    const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('github_unauthorized');
      }
      if (response.status === 403) {
        throw new Error('github_forbidden');
      }
      if (response.status === 404) {
        throw new Error('github_not_found');
      }
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
          contentType: a.content_type ?? null
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
}
