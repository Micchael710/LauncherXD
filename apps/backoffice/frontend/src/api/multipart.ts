export interface MultipartFilePart {
    id?: string;
    path: string;
    logical_path: string;
    filename?: string;
    operation: 'add' | 'replace' | 'delete';
    size: number;
    sha256?: string;
    part_index?: number;
    part_count?: number;
    final_sha256?: string;
    created_at?: string;
}

export interface MultipartGroup<T extends MultipartFilePart> {
    logical_path: string;
    parts: T[];
    expected_part_count?: number;
    final_sha256?: string;
    is_complete: boolean;
    missing_indices: number[];
    duplicate_indices: number[];
    has_inconsistent_part_count: boolean;
    has_inconsistent_final_sha256: boolean;
    diagnostics: string[];
}

export interface GroupedFilesResult<T extends MultipartFilePart> {
    standalone: T[];
    multipartGroups: MultipartGroup<T>[];
}

export function isMultipartFile<T extends MultipartFilePart>(file: T): boolean {
    return typeof file.part_index === 'number' && typeof file.part_count === 'number';
}

export function groupMultipart<T extends MultipartFilePart>(files: T[]): MultipartGroup<T>[] {
    return partitionReleaseFiles(files).multipartGroups;
}

export function partitionReleaseFiles<T extends MultipartFilePart>(files: readonly T[]): GroupedFilesResult<T> {
    const standalone: T[] = [];
    const multipartMap = new Map<string, T[]>();

    for (const file of files) {
        if (isMultipartFile(file)) {
            const group = multipartMap.get(file.logical_path);
            if (group) {
                group.push(file);
            } else {
                multipartMap.set(file.logical_path, [file]);
            }
        } else {
            standalone.push(file);
        }
    }

    const multipartGroups: MultipartGroup<T>[] = [];

    for (const [logical_path, rawParts] of multipartMap.entries()) {
        const sortedParts = [...rawParts].sort((a, b) => (a.part_index ?? 0) - (b.part_index ?? 0));

        const partCounts = Array.from(
            new Set(sortedParts.map(p => p.part_count).filter((c): c is number => typeof c === 'number'))
        );
        const has_inconsistent_part_count = partCounts.length > 1;
        const expected_part_count = partCounts[0];

        const allFinalShas = sortedParts.map(p =>
            typeof p.final_sha256 === 'string' && p.final_sha256.length > 0 ? p.final_sha256 : undefined
        );
        const uniqueFinalShas = Array.from(new Set(allFinalShas));
        const has_inconsistent_final_sha256 = uniqueFinalShas.length > 1;
        const final_sha256 = uniqueFinalShas.find((s): s is string => typeof s === 'string' && s.length > 0);

        const indexCounts = new Map<number, number>();
        let hasIndexLessThanOne = false;
        for (const p of sortedParts) {
            if (typeof p.part_index === 'number') {
                if (p.part_index < 1) {
                    hasIndexLessThanOne = true;
                }
                indexCounts.set(p.part_index, (indexCounts.get(p.part_index) || 0) + 1);
            }
        }

        const duplicate_indices = Array.from(indexCounts.entries())
            .filter(([, count]) => count > 1)
            .map(([idx]) => idx)
            .sort((a, b) => a - b);

        const missing_indices: number[] = [];
        if (expected_part_count !== undefined && !has_inconsistent_part_count && expected_part_count >= 1) {
            for (let i = 1; i <= expected_part_count; i++) {
                if (!indexCounts.has(i)) {
                    missing_indices.push(i);
                }
            }
        }

        const diagnostics: string[] = [];
        if (has_inconsistent_part_count) {
            diagnostics.push(`Inconsistent part count across parts: ${partCounts.join(', ')}`);
        }
        if (has_inconsistent_final_sha256) {
            diagnostics.push('Inconsistent final SHA-256 across parts');
        }
        if (duplicate_indices.length > 0) {
            diagnostics.push(`Duplicate part indices: ${duplicate_indices.join(', ')}`);
        }
        if (missing_indices.length > 0) {
            diagnostics.push(`Missing part indices: ${missing_indices.join(', ')}`);
        }
        if (hasIndexLessThanOne) {
            diagnostics.push('Part indices must start at 1');
        }

        const is_complete =
            !has_inconsistent_part_count &&
            !has_inconsistent_final_sha256 &&
            !hasIndexLessThanOne &&
            duplicate_indices.length === 0 &&
            missing_indices.length === 0 &&
            expected_part_count !== undefined &&
            expected_part_count > 0 &&
            sortedParts.length === expected_part_count;

        multipartGroups.push({
            logical_path,
            parts: sortedParts,
            expected_part_count,
            final_sha256,
            is_complete,
            missing_indices,
            duplicate_indices,
            has_inconsistent_part_count,
            has_inconsistent_final_sha256,
            diagnostics
        });
    }

    return {
        standalone,
        multipartGroups
    };
}
