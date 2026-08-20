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
  state?: string;
  digest?: string;
}

export interface ArtifactStorageProvider {
  checkConnection(): Promise<boolean>;
  getRelease(tag: string): Promise<StorageRelease | null>;
  listAssets(tag: string): Promise<StorageAsset[]>;
}

export interface ArtifactPublishingProvider extends ArtifactStorageProvider {
  createDraftRelease(tag: string, name: string, notes: string, prerelease?: boolean): Promise<StorageRelease>;
  updateRelease(releaseId: string, draft: boolean): Promise<void>;
  uploadGeneratedAsset(releaseId: string, filename: string, content: string | ArrayBuffer, contentType: string): Promise<StorageAsset>;
  deleteGeneratedManifest(releaseId: string, assetId: string): Promise<void>;
}
