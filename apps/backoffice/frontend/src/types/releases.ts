export type ReleaseType = 'launcher' | 'modpack';
export type ReleaseChannel = 'stable' | 'beta';
export type ReleaseStatus = 'draft' | 'published' | 'deprecated';

export interface Release {
    id: string;
    version: string;
    channel: ReleaseChannel;
    release_type: ReleaseType;
    status: ReleaseStatus;
    total_size?: number;
    release_notes?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateReleaseInput {
    version: string;
    channel: ReleaseChannel;
    release_type: ReleaseType;
    total_size?: number;
    release_notes?: string;
}

export type UpdateReleaseInput = Partial<CreateReleaseInput>;

export interface ExpectedAsset {
    fileId: string;
    name: string;
}

export interface GitHubReleasePrepareResponse {
    github_tag: string;
    github_release_id: number;
    expectedAssets: ExpectedAsset[];
}

export interface GitHubAssetItemStatus {
    status: 'ready' | 'asset_not_uploaded' | 'state_invalid' | 'size_mismatch' | 'digest_missing' | 'digest_invalid' | 'digest_mismatch';
    state?: string;
    github_asset_id?: number;
    download_url?: string;
    operation?: string;
}

export interface GitHubReleaseStatusResponse {
    status: 'ready' | 'syncing';
    assetStatuses: Record<string, GitHubAssetItemStatus>;
    unexpectedAssets: { id: number; name: string }[];
}

export interface PublishReleaseResponse {
    status: string;
}

export type DeletionStepStatus = 'deleted' | 'not_present' | 'failed' | 'pending';
export type D1DeletionStepStatus = 'deleted' | 'failed' | 'pending';
export type GitHubResolutionType = 'metadata' | 'canonical_tag_lookup' | 'not_present';

export interface DeletionSteps {
    github_release: DeletionStepStatus;
    github_tag: DeletionStepStatus;
    d1: D1DeletionStepStatus;
}

export interface DeleteEverywhereResponse {
    status?: string;
    deleted: boolean;
    purged?: boolean;
    release_id: string;
    github_release_deleted: boolean;
    github_tag_deleted: boolean;
    d1_deleted: boolean;
    deletion_steps?: DeletionSteps;
    github_resolution?: GitHubResolutionType;
}
