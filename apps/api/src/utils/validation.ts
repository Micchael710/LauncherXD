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

  // Reject directory traversal segments
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '.' || segment === '..') return false;
    if (segment.trim() === '') return false; // Prevents double slashes like a//b
  }

  return true;
}

export function isValidNewsUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Allowlist explicit protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

export function isSafeSettingKey(key: string | undefined | null): boolean {
  if (!key || key.trim() === '') return false;

  // Reject keys associated with secrets or critical config
  const blacklist = ['github_token', 'token', 'password', 'secret', 'jwt', 'bearer', 'authorization', 'api_key', 'private_key', 'credential'];
  const normalized = key.toLowerCase();

  for (const bad of blacklist) {
    if (normalized.includes(bad)) return false;
  }

  return true;
}

// Validates individual files (used during edits)
export function validateIndividualFileConsistency(file: any): void {
  if (file.operation === 'add' || file.operation === 'replace') {
    if (!isValidSha256(file.sha256)) {
      throw new Error(`Invalid sha256 format for file: ${file.path}`);
    }
  }

  if (file.part_index !== null && file.part_index !== undefined) {
    if (file.part_count === null || file.part_count === undefined) {
      throw new Error(`part_count must be defined if part_index is defined (file: ${file.path})`);
    }

    if (file.final_sha256 && !isValidSha256(file.final_sha256)) {
      throw new Error(`Invalid final_sha256 format for multipart file: ${file.path}`);
    }

    if (file.part_index < 1) throw new Error(`part_index must be >= 1`);
    if (file.part_count < 1) throw new Error(`part_count must be >= 1`);
    if (file.part_index > file.part_count) throw new Error(`part_index cannot be greater than part_count`);
  }
}

// Validates that the entire release is ready to publish (used by the validation endpoint)
export function validateReleaseFilesConsistency(files: any[]): void {
  const multipartGroups = new Map<string, { partCount: number, finalSha256: string | undefined, indices: Set<number> }>();

  for (const file of files) {
    validateIndividualFileConsistency(file);

    if (file.part_index !== null && file.part_index !== undefined) {
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
          throw new Error(`Inconsistent part_count in multipart group: ${groupKey}`);
        }

        if (group.finalSha256 !== file.final_sha256) {
          throw new Error(`Inconsistent final_sha256 in multipart group: ${groupKey}`);
        }

        if (group.indices.has(file.part_index)) {
          throw new Error(`Duplicate part_index ${file.part_index} in multipart group: ${groupKey}`);
        }

        group.indices.add(file.part_index);
      }
    }
  }

  // Validate that no parts are missing or out of bounds (only required for readiness)
  for (const [groupKey, group] of multipartGroups.entries()) {
    if (group.indices.size !== group.partCount) {
      throw new Error(`Missing parts in multipart group: ${groupKey}. Expected ${group.partCount} but got ${group.indices.size}`);
    }

    for (let i = 1; i <= group.partCount; i++) {
      if (!group.indices.has(i)) {
        throw new Error(`Missing part_index ${i} in multipart group: ${groupKey}`);
      }
    }
  }
}
