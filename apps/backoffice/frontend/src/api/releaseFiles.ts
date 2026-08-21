import { LocalApiClient, ApiClientError } from './client';
import type {
    CreateReleaseFileInput,
    UpdateReleaseFileInput,
    ReleaseFile,
    CreateReleaseFileResponse,
    ReleaseFileActionResponse,
    UploadProgress,
    UploadAssetResponse
} from '../types/releaseFiles';

export const ReleaseFilesApi = {
    async listReleaseFiles(releaseId: string): Promise<{ value: ReleaseFile[]; Count: number }> {
        return LocalApiClient.fetch(`/api/admin/releases/${releaseId}/files`);
    },
    async createReleaseFile(releaseId: string, input: CreateReleaseFileInput): Promise<CreateReleaseFileResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${releaseId}/files`, {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
        });
    },
    async updateReleaseFile(releaseId: string, fileId: string, input: UpdateReleaseFileInput): Promise<ReleaseFileActionResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${releaseId}/files/${fileId}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
        });
    },
    async deleteReleaseFile(releaseId: string, fileId: string): Promise<ReleaseFileActionResponse> {
        return LocalApiClient.fetch(`/api/admin/releases/${releaseId}/files/${fileId}`, {
            method: 'DELETE'
        });
    },
    async uploadPhysicalAsset(
        releaseId: string,
        fileId: string,
        file: File,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<UploadAssetResponse> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `http://127.0.0.1:3000/api/local/releases/${encodeURIComponent(releaseId)}/files/${encodeURIComponent(fileId)}/upload`;

            xhr.open('POST', url, true);

            if (onProgress && xhr.upload) {
                xhr.upload.onprogress = (event: ProgressEvent) => {
                    if (event.lengthComputable && event.total > 0) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        onProgress({
                            loaded: event.loaded,
                            total: event.total,
                            percent
                        });
                    }
                };
            }

            xhr.onload = () => {
                try {
                    const json = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(json as UploadAssetResponse);
                    } else {
                        const errorMsg = json.message || json.error || `Upload failed with status ${xhr.status}`;
                        const err = new ApiClientError(xhr.status, json.error || 'UPLOAD_FAILED', json.details || [], errorMsg);
                        reject(err);
                    }
                } catch {
                    reject(new ApiClientError(xhr.status, 'INVALID_RESPONSE', [], `Failed to parse upload response (${xhr.status})`));
                }
            };

            xhr.onerror = () => {
                reject(new ApiClientError(0, 'NETWORK_ERROR', [], 'Network error while uploading asset to local backend'));
            };

            const formData = new FormData();
            formData.append('file', file, file.name);
            xhr.send(formData);
        });
    }
};
