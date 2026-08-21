import { ApiClientError } from './client';

export interface FileInspectResult {
    filename: string;
    size: number;
    sha256: string;
}

export const InspectApi = {
    async inspectLocalFile(file: File): Promise<FileInspectResult> {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('http://127.0.0.1:3000/api/local/file-inspect', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const error = data.error || (res.status === 400 ? 'Invalid file or file too large' : 'INSPECT_ERROR');
            throw new ApiClientError(res.status, error, Array.isArray(data.details) ? data.details : [], data.error || data.message);
        }

        return res.json() as Promise<FileInspectResult>;
    }
};
