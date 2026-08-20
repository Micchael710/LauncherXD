export interface StorageRelease {
  id: string;
  tag: string;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  publishedAt: string | null;
}

export interface StorageAsset {
  id: string;
  name: string;
  size: number;
  downloadUrl: string;
  contentType: string | null;
}

export interface ArtifactStorageProvider {
  checkConnection(): Promise<boolean>;
  getRelease(tag: string): Promise<StorageRelease | null>;
  listAssets(tag: string): Promise<StorageAsset[]>;
}
