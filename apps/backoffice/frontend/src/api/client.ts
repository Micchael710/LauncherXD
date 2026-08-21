export interface ApiStructuredErrorDetail {
    code: string;
    path?: string;
    message?: string;
}

export type ApiErrorDetail = string | ApiStructuredErrorDetail;

export interface ApiErrorResponse {
    error?: string;
    details?: ApiErrorDetail[];
    message?: string;
}

export class ApiClientError extends Error {
    readonly status: number;
    readonly error: string;
    readonly details: ApiErrorDetail[];

    constructor(status: number, error: string, details: ApiErrorDetail[] = [], message?: string) {
        super(message || error);
        this.name = 'ApiClientError';
        this.status = status;
        this.error = error;
        this.details = details;
    }
}

function getDetailCode(detail: ApiErrorDetail): string {
    return typeof detail === 'string' ? detail : detail.code;
}

function formatValidationDetail(detail: ApiErrorDetail): string {
    if (typeof detail === 'string') {
        const detailMessages: Record<string, string> = {
            invalid_version: 'Invalid SemVer version (e.g. 1.0.0).',
            invalid_channel: 'Invalid channel (must be stable or beta).',
            invalid_release_type: 'Invalid release type (must be launcher or modpack).',
            invalid_total_size: 'Invalid total size (must be a positive number).',
            notes_too_long: 'Release notes are too long (max 50,000 characters).',
            invalid_json: 'Invalid JSON payload.',
            release_not_ready: 'Release is not ready for preparation.',
            missing_confirm_version: 'Confirmation version is required.',
            invalid_confirm_version: 'Confirmation version does not match release version.',
            invalid_operation: 'Invalid operation (must be add, replace, or delete).',
            invalid_size: 'Invalid size (must be a non-negative number).',
            invalid_sha256: 'Invalid SHA-256 hash.',
            invalid_path: 'Invalid path.',
            invalid_logical_path: 'Invalid logical path.',
            missing_part_count: 'Missing part count for multipart file.',
            invalid_part_index: 'Invalid part index (must be >= 1).',
            invalid_part_count: 'Invalid part count (must be >= 1).',
            part_index_exceeds_count: 'Part index exceeds part count.',
            invalid_final_sha256: 'Invalid final SHA-256 hash.',
            inconsistent_part_count: 'Inconsistent part count across multipart parts.',
            inconsistent_final_sha256: 'Inconsistent final SHA-256 across multipart parts.',
            duplicate_part_index: 'Duplicate part index.',
            multipart_missing_part: 'Missing parts for multipart file.',
            multipart_missing_part_index: 'Missing multipart part index.',
            invalid_title: 'Invalid title (must be non-empty and max 200 characters).',
            summary_too_long: 'Summary is too long (max 1,000 characters).',
            invalid_image_url: 'Invalid image URL (must be an absolute http: or https: URL).',
            invalid_target_url: 'Invalid target URL (must be an absolute http: or https: URL).',
            invalid_or_unsafe_key: 'Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).',
            missing_required_fields: 'Missing required fields (value and value_type are required).',
            invalid_boolean_value: 'Invalid boolean value (must be exactly "true" or "false").',
            invalid_number_value: 'Invalid number value (must be a valid number).'
        };
        return detailMessages[detail] || detail;
    }

    const { code, path, message } = detail;
    const baseMap: Record<string, string> = {
        invalid_path: 'Invalid path',
        invalid_logical_path: 'Invalid logical path',
        invalid_sha256: 'Invalid SHA-256 hash',
        invalid_final_sha256: 'Invalid final SHA-256 hash',
        invalid_operation: 'Invalid operation (must be add, replace, or delete)',
        invalid_size: 'Invalid size (must be a non-negative number)',
        missing_part_count: 'Missing part count for multipart file',
        invalid_part_index: 'Invalid part index',
        invalid_part_count: 'Invalid part count',
        part_index_exceeds_count: 'Part index exceeds part count',
        inconsistent_part_count: 'Inconsistent part count',
        inconsistent_final_sha256: 'Inconsistent final SHA-256',
        duplicate_part_index: 'Duplicate part index',
        multipart_missing_part: 'Missing parts for multipart file',
        multipart_missing_part_index: 'Missing multipart part index',
        invalid_json: 'Invalid JSON payload',
        invalid_or_unsafe_key: 'Invalid or unsafe setting key',
        missing_required_fields: 'Missing required fields',
        invalid_boolean_value: 'Invalid boolean value',
        invalid_number_value: 'Invalid number value'
    };

    const base = baseMap[code] || code;
    const extras: string[] = [];
    if (path) extras.push(`path: ${path}`);
    if (message) extras.push(`message: ${message}`);
    return extras.length > 0 ? `${base} (${extras.join(', ')})` : base;
}

export function isSafeSettingKey(key: string | undefined | null): boolean {
    if (!key || key.trim() === '') return false;

    const normalized = key.toLowerCase();

    if (normalized.startsWith('cloudflare_access_') || normalized.startsWith('github_')) {
        return false;
    }

    const blacklist = [
        'github_token',
        'token',
        'password',
        'secret',
        'jwt',
        'bearer',
        'authorization',
        'api_key',
        'private_key',
        'credential'
    ];

    for (const bad of blacklist) {
        if (normalized.includes(bad)) return false;
    }

    return true;
}

export function formatApiErrorMessage(err: unknown, context?: 'release' | 'news' | 'file' | 'setting'): string {
    if (err instanceof ApiClientError) {
        if (err.error === 'ADMIN_AUTH_NOT_CONFIGURED') {
            return 'Admin authentication is not configured.';
        }
        if (err.error === 'ADMIN_UNAUTHORIZED') {
            return 'Admin unauthorized (invalid or missing credentials).';
        }
        if (err.error === 'GITHUB_AUTH_NOT_CONFIGURED') {
            return 'GitHub upload credentials are not configured.';
        }
        if (err.error === 'GITHUB_UNAUTHORIZED') {
            return 'GitHub authentication failed (invalid or expired token).';
        }
        if (err.error === 'GITHUB_FORBIDDEN') {
            return 'GitHub upload forbidden (insufficient permissions).';
        }
        if (err.error === 'GITHUB_NOT_FOUND') {
            return 'GitHub release or repository not found.';
        }
        if (err.error === 'GITHUB_ASSET_CONFLICT') {
            return 'Existing asset does not match expected metadata.';
        }
        if (err.error === 'FILE_SIZE_MISMATCH') {
            return err.message || 'Selected file size does not match expected release file size.';
        }
        if (err.error === 'FILE_SHA256_MISMATCH') {
            return err.message || 'Selected file SHA-256 does not match expected hash.';
        }
        if (err.error === 'NO_UPLOAD_REQUIRED') {
            return 'No upload required for delete operation.';
        }
        if (err.error === 'not_found' || err.status === 404) {
            if (context === 'news') {
                return 'News item not found.';
            }
            if (context === 'file') {
                return 'File not found.';
            }
            if (context === 'setting') {
                return 'Setting not found.';
            }
            return 'Release not found.';
        }
        if (err.error === 'conflict' || err.status === 409) {
            const codes = err.details.map(getDetailCode);
            if (codes.includes('duplicate_release')) {
                return 'A release with this version already exists.';
            }
            if (codes.includes('cannot_edit_published')) {
                return 'Cannot edit a published release.';
            }
            if (codes.includes('cannot_edit_deprecated')) {
                return 'Cannot edit a deprecated release.';
            }
            if (codes.includes('only_drafts_can_be_deleted')) {
                return 'Only draft releases can be deleted.';
            }
            if (codes.includes('not_draft') || codes.includes('release_not_draft')) {
                return 'Release is not a draft.';
            }
            if (codes.includes('tag_already_published')) {
                return 'This release tag is already published.';
            }
            if (codes.includes('not_prepared')) {
                return 'Release is not prepared on GitHub.';
            }
            if (codes.includes('assets_missing')) {
                return 'Release assets are missing on GitHub.';
            }
            if (codes.includes('duplicate_file_or_part')) {
                return 'A file or part with this path already exists.';
            }
            if (err.details.length > 0) {
                const formatted = err.details.map(d => {
                    if (typeof d === 'string') return d;
                    return `${d.code}${d.path ? ` (${d.path})` : ''}`;
                }).join(', ');
                return `Conflict: ${formatted}`;
            }
            return 'Conflict: operation not permitted in current release state.';
        }
        if (err.error === 'validation_error' || err.status === 400) {
            if (err.details.length > 0) {
                const mapped = err.details.map(formatValidationDetail);
                return `Validation error: ${mapped.join(', ')}`;
            }
            return 'Validation error in request.';
        }
        if (err.message) {
            return err.message;
        }
        return `API Error (${err.status}): ${err.error}`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}

export class LocalApiClient {
    static async fetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
        const res = await fetch(`http://127.0.0.1:3000${path}`, options);
        if (!res.ok) {
            const data: ApiErrorResponse = await res.json().catch(() => ({} as ApiErrorResponse));
            const errorCode = data.error || (res.status === 404 ? 'not_found' : 'API_ERROR');
            const details = Array.isArray(data.details) ? data.details : [];
            const message = data.message;
            throw new ApiClientError(res.status, errorCode, details, message);
        }
        return res.json() as Promise<T>;
    }
}
