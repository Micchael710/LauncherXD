export function isValidSha256(hash: string | undefined | null): boolean {
  if (!hash) return false;
  return /^[a-fA-F0-9]{64}$/.test(hash);
}

export function isValidSemVer(version: string | undefined | null): boolean {
  if (!version) return false;
  // A reasonable regex for SemVer (e.g., 1.0.0, 1.0.0-beta.1)
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(version);
}

export function isSafePath(path: string | undefined | null): boolean {
  if (!path || path.trim() === '') return false;

  // Reject absolute paths
  if (path.startsWith('/') || path.startsWith('\\')) return false;

  // Reject drive letters and UNC paths (Windows)
  if (/^[a-zA-Z]:/.test(path) || path.startsWith('\\\\')) return false;

  // Reject backslashes entirely (force POSIX style)
  if (path.includes('\\')) return false;

  // Reject NUL and control characters
  if (/[\x00-\x1F\x7F]/.test(path)) return false;

  // Reject alternate data streams
  if (path.includes(':')) return false;

  const reservedNames = new Set([
    'con', 'prn', 'aux', 'nul',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
  ]);

  // Reject directory traversal segments
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '.' || segment === '..') return false;
    if (segment.trim() === '') return false; // Prevents double slashes like a//b

    // Reject trailing dot or space
    if (segment.endsWith(' ') || segment.endsWith('.')) return false;

    // Windows reserved names
    const basename = segment.split('.')[0].toLowerCase();
    if (reservedNames.has(basename)) return false;
  }

  return true;
}

export function isValidNewsUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Allowlist explicit protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidNewsVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const pathname = parsed.pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
  } catch {
    return false;
  }
}

export function isSafeSettingKey(key: string | undefined | null): boolean {
  if (!key || key.trim() === '') return false;

  const normalized = key.toLowerCase();

  if (normalized.startsWith('cloudflare_access_') || normalized.startsWith('github_')) {
    return false;
  }

  // Reject keys associated with secrets or critical config
  const blacklist = ['github_token', 'token', 'password', 'secret', 'jwt', 'bearer', 'authorization', 'api_key', 'private_key', 'credential'];

  for (const bad of blacklist) {
    if (normalized.includes(bad)) return false;
  }

  return true;
}

export interface ValidationErrorDetail {
  code: string;
  path?: string;
  message?: string;
}

export class ValidationError extends Error {
  details: ValidationErrorDetail[];
  constructor(details: ValidationErrorDetail[]) {
    super('Validation Error');
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Validates individual files (used during edits)
export function validateIndividualFileConsistency(file: any): void {
  const issues: ValidationErrorDetail[] = [];

  if (file.operation === 'add' || file.operation === 'replace') {
    if (!isValidSha256(file.sha256)) {
      issues.push({ code: 'invalid_sha256', path: file.path });
    }
  }

  if (file.part_index !== null && file.part_index !== undefined) {
    if (file.part_count === null || file.part_count === undefined) {
      issues.push({ code: 'missing_part_count', path: file.path });
    } else {
      if (file.part_index < 1) issues.push({ code: 'invalid_part_index', path: file.path });
      if (file.part_count < 1) issues.push({ code: 'invalid_part_count', path: file.path });
      if (file.part_index > file.part_count) issues.push({ code: 'part_index_exceeds_count', path: file.path });
    }

    if (file.final_sha256 && !isValidSha256(file.final_sha256)) {
      issues.push({ code: 'invalid_final_sha256', path: file.path });
    }
  }

  if (!isSafePath(file.path)) {
    issues.push({ code: 'invalid_path', path: file.path });
  }

  if (!isSafePath(file.logical_path)) {
    issues.push({ code: 'invalid_logical_path', path: file.path });
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}

// Validates that the entire release is ready to publish (used by the validation endpoint)
export function validateReleaseReady(release: any, files: any[]): ValidationErrorDetail[] {
  const issues: ValidationErrorDetail[] = [];

  if (!isValidSemVer(release.version)) issues.push({ code: 'invalid_version' });
  if (release.channel !== 'stable' && release.channel !== 'beta') issues.push({ code: 'invalid_channel' });
  if (release.release_type !== 'launcher' && release.release_type !== 'modpack') issues.push({ code: 'invalid_release_type' });
  if (release.total_size !== null && release.total_size < 0) issues.push({ code: 'invalid_total_size' });

  const multipartGroups = new Map<string, { partCount: number, finalSha256: string | undefined, indices: Set<number> }>();

  for (const file of files) {
    try {
      validateIndividualFileConsistency(file);
    } catch (err: any) {
      if (err instanceof ValidationError) {
        issues.push(...err.details);
      } else {
        issues.push({ code: 'file_consistency_error', path: file.path });
      }
    }

    if (file.part_index !== null && file.part_index !== undefined && file.part_count !== null && file.part_count !== undefined) {
      const groupKey = file.logical_path;
      if (!multipartGroups.has(groupKey)) {
        multipartGroups.set(groupKey, {
          partCount: file.part_count,
          finalSha256: file.final_sha256,
          indices: new Set([file.part_index])
        });
      } else {
        const group = multipartGroups.get(groupKey)!;

        if (group.partCount !== file.part_count) {
          issues.push({ code: 'inconsistent_part_count', path: file.path });
        }

        if (group.finalSha256 !== file.final_sha256) {
          issues.push({ code: 'inconsistent_final_sha256', path: file.path });
        }

        if (group.indices.has(file.part_index)) {
          issues.push({ code: 'duplicate_part_index', path: file.path });
        }

        group.indices.add(file.part_index);
      }
    }
  }

  for (const [groupKey, group] of multipartGroups.entries()) {
    if (group.indices.size !== group.partCount) {
      issues.push({ code: 'multipart_missing_part', path: groupKey });
    }

    for (let i = 1; i <= group.partCount; i++) {
      if (!group.indices.has(i)) {
        issues.push({ code: 'multipart_missing_part_index', path: groupKey, message: i.toString() });
      }
    }
  }

  return issues;
}

export async function getExpectedAssetName(physicalPath: string, basename: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(physicalPath));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const safeBasename = basename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
  return 'lx-' + hashHex + '-' + safeBasename;
}

export function getCanonicalTag(releaseType: string, channel: string, version: string): string {
  return releaseType + '-' + channel + '-v' + version;
}
