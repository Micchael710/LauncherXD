export function isValidSha256(hash: string | undefined | null): boolean {
  if (!hash) return false;
  return /^[a-fA-F0-9]{64}$/.test(hash);
}

export function validateReleaseFilesConsistency(files: any[]): void {
  const multipartGroups = new Map<string, { partCount: number, finalSha256: string | undefined, indices: Set<number> }>();

  for (const file of files) {
    // Validate operation rules
    if (file.operation === 'add' || file.operation === 'replace') {
      if (!isValidSha256(file.sha256)) {
        throw new Error(`Invalid sha256 format for file: ${file.path}`);
      }
    }

    // Validate multipart rules
    if (file.part_index !== null && file.part_index !== undefined) {
      if (file.part_count === null || file.part_count === undefined) {
        throw new Error(`part_count must be defined if part_index is defined (file: ${file.path})`);
      }
      
      if (file.final_sha256 && !isValidSha256(file.final_sha256)) {
        throw new Error(`Invalid final_sha256 format for multipart file: ${file.path}`);
      }

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

  // Validate that no parts are missing or out of bounds
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
