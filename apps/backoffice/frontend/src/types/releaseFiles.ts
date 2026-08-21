export type ReleaseFileOperation = 'add' | 'replace' | 'delete';

export interface ReleaseFile {
    id: string;
    release_id: string;
    path: string;
    logical_path: string;
    filename: string;
    operation: ReleaseFileOperation;
    size: number;
    sha256?: string;
    download_url?: string;
    github_asset_id?: string;
    part_index?: number;
    part_count?: number;
    final_sha256?: string;
    created_at: string;
}

export interface CreateReleaseFileInput {
    path: string;
    logical_path: string;
    operation: ReleaseFileOperation;
    size: number;
    sha256?: string;
    part_index?: number;
    part_count?: number;
    final_sha256?: string;
}

export type UpdateReleaseFileInput = Partial<CreateReleaseFileInput>;

export interface CreateReleaseFileResponse {
    id: string;
    status: 'created';
}

export interface ReleaseFileActionResponse {
    status: 'ok';
}

export interface UploadProgress {
    loaded: number;
    total: number;
    percent: number;
}

export interface UploadAssetResponse {
    status: 'ok';
    verified: boolean;
    message?: string;
    warning?: string;
    asset?: {
        id: number;
        name: string;
        download_url?: string;
    };
}
