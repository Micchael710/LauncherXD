import { describe, test, expect } from 'vitest';
import { partitionReleaseFiles, groupMultipart, isMultipartFile, type MultipartFilePart } from '../api/multipart';

describe('Multipart Utility Unit Tests', () => {
    const fullSha1 = '1111111111111111111111111111111111111111111111111111111111111111';
    const fullSha2 = '2222222222222222222222222222222222222222222222222222222222222222';
    const fullFinalSha = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const diffFinalSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    test('1. Does not mutate the input array', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p2', logical_path: 'log.zip', operation: 'add', size: 100, part_index: 2, part_count: 2 },
            { path: 'p1', logical_path: 'log.zip', operation: 'add', size: 100, part_index: 1, part_count: 2 }
        ];
        const originalFirstPath = inputFiles[0].path;

        const result = partitionReleaseFiles(inputFiles);

        expect(inputFiles[0].path).toBe(originalFirstPath);
        expect(inputFiles.length).toBe(2);
        expect(result.multipartGroups[0].parts[0].path).toBe('p1');
    });

    test('2. Sorts parts in ascending order (1, 2, 3)', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p3', logical_path: 'archive.tar', operation: 'add', size: 300, part_index: 3, part_count: 3 },
            { path: 'p1', logical_path: 'archive.tar', operation: 'add', size: 100, part_index: 1, part_count: 3 },
            { path: 'p2', logical_path: 'archive.tar', operation: 'add', size: 200, part_index: 2, part_count: 3 }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups).toHaveLength(1);
        expect(groups[0].parts.map(p => p.part_index)).toEqual([1, 2, 3]);
        expect(groups[0].parts.map(p => p.path)).toEqual(['p1', 'p2', 'p3']);
    });

    test('3. Correctly identifies a complete multipart group', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'pack.zip', operation: 'add', size: 50, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p2', logical_path: 'pack.zip', operation: 'add', size: 50, part_index: 2, part_count: 2, final_sha256: fullFinalSha }
        ];

        const result = partitionReleaseFiles(inputFiles);

        expect(result.multipartGroups).toHaveLength(1);
        const group = result.multipartGroups[0];
        expect(group.is_complete).toBe(true);
        expect(group.missing_indices).toEqual([]);
        expect(group.duplicate_indices).toEqual([]);
        expect(group.has_inconsistent_part_count).toBe(false);
        expect(group.has_inconsistent_final_sha256).toBe(false);
        expect(group.diagnostics).toEqual([]);
    });

    test('4. Correctly flags missing parts and identifies missing indices', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'bundle.bin', operation: 'add', size: 10, part_index: 1, part_count: 3, final_sha256: fullFinalSha },
            { path: 'p3', logical_path: 'bundle.bin', operation: 'add', size: 10, part_index: 3, part_count: 3, final_sha256: fullFinalSha }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(false);
        expect(groups[0].missing_indices).toEqual([2]);
        expect(groups[0].diagnostics).toContain('Missing part indices: 2');
    });

    test('5. Correctly flags duplicate part index', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1_a', logical_path: 'data.iso', operation: 'add', size: 100, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p1_b', logical_path: 'data.iso', operation: 'add', size: 100, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p2', logical_path: 'data.iso', operation: 'add', size: 100, part_index: 2, part_count: 2, final_sha256: fullFinalSha }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(false);
        expect(groups[0].duplicate_indices).toEqual([1]);
        expect(groups[0].diagnostics).toContain('Duplicate part indices: 1');
    });

    test('6. Correctly flags inconsistent part_count across parts', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'assets.zip', operation: 'add', size: 100, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p2', logical_path: 'assets.zip', operation: 'add', size: 100, part_index: 2, part_count: 3, final_sha256: fullFinalSha }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(false);
        expect(groups[0].has_inconsistent_part_count).toBe(true);
        expect(groups[0].diagnostics).toContain('Inconsistent part count across parts: 2, 3');
    });

    test('7. Correctly flags inconsistent final_sha256 across parts', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'video.mp4', operation: 'add', size: 500, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p2', logical_path: 'video.mp4', operation: 'add', size: 500, part_index: 2, part_count: 2, final_sha256: diffFinalSha }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(false);
        expect(groups[0].has_inconsistent_final_sha256).toBe(true);
        expect(groups[0].diagnostics).toContain('Inconsistent final SHA-256 across parts');
    });

    test('7b. Flags inconsistency when first part has final_sha256 and second part omits it', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'archive.zip', operation: 'add', size: 500, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p2', logical_path: 'archive.zip', operation: 'add', size: 500, part_index: 2, part_count: 2 }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(false);
        expect(groups[0].has_inconsistent_final_sha256).toBe(true);
        expect(groups[0].diagnostics).toContain('Inconsistent final SHA-256 across parts');
    });

    test('7c. Flags inconsistency when first part omits final_sha256 and second part has it', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'archive.zip', operation: 'add', size: 500, part_index: 1, part_count: 2 },
            { path: 'p2', logical_path: 'archive.zip', operation: 'add', size: 500, part_index: 2, part_count: 2, final_sha256: fullFinalSha }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(false);
        expect(groups[0].has_inconsistent_final_sha256).toBe(true);
        expect(groups[0].diagnostics).toContain('Inconsistent final SHA-256 across parts');
    });

    test('7d. Considers group consistent when all parts omit final_sha256', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'archive.zip', operation: 'add', size: 500, part_index: 1, part_count: 2 },
            { path: 'p2', logical_path: 'archive.zip', operation: 'add', size: 500, part_index: 2, part_count: 2 }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].is_complete).toBe(true);
        expect(groups[0].has_inconsistent_final_sha256).toBe(false);
        expect(groups[0].final_sha256).toBeUndefined();
    });

    test('8. Non-multipart files remain independent in standalone result', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'single.jar', logical_path: 'single.jar', operation: 'add', size: 1024, sha256: fullSha1 },
            { path: 'p1', logical_path: 'split.zip', operation: 'add', size: 200, part_index: 1, part_count: 2 },
            { path: 'p2', logical_path: 'split.zip', operation: 'add', size: 200, part_index: 2, part_count: 2 },
            { path: 'config.json', logical_path: 'config.json', operation: 'add', size: 50 }
        ];

        const result = partitionReleaseFiles(inputFiles);

        expect(result.standalone).toHaveLength(2);
        expect(result.standalone.map(f => f.path)).toEqual(['single.jar', 'config.json']);
        expect(result.multipartGroups).toHaveLength(1);
        expect(result.multipartGroups[0].logical_path).toBe('split.zip');
        expect(isMultipartFile(inputFiles[0])).toBe(false);
        expect(isMultipartFile(inputFiles[1])).toBe(true);
    });

    test('9. Two different logical_paths produce separate multipart groups', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'g1_p1', logical_path: 'group1.zip', operation: 'add', size: 100, part_index: 1, part_count: 2 },
            { path: 'g2_p1', logical_path: 'group2.zip', operation: 'add', size: 100, part_index: 1, part_count: 2 },
            { path: 'g1_p2', logical_path: 'group1.zip', operation: 'add', size: 100, part_index: 2, part_count: 2 },
            { path: 'g2_p2', logical_path: 'group2.zip', operation: 'add', size: 100, part_index: 2, part_count: 2 }
        ];

        const result = partitionReleaseFiles(inputFiles);

        expect(result.multipartGroups).toHaveLength(2);
        const group1 = result.multipartGroups.find(g => g.logical_path === 'group1.zip');
        const group2 = result.multipartGroups.find(g => g.logical_path === 'group2.zip');

        expect(group1).toBeDefined();
        expect(group1?.parts.map(p => p.path)).toEqual(['g1_p1', 'g1_p2']);
        expect(group2).toBeDefined();
        expect(group2?.parts.map(p => p.path)).toEqual(['g2_p1', 'g2_p2']);
    });

    test('10. Full SHA-256 and final_sha256 hashes are preserved completely', () => {
        const inputFiles: MultipartFilePart[] = [
            { path: 'p1', logical_path: 'fullhash.bin', operation: 'add', size: 50, sha256: fullSha1, part_index: 1, part_count: 2, final_sha256: fullFinalSha },
            { path: 'p2', logical_path: 'fullhash.bin', operation: 'add', size: 50, sha256: fullSha2, part_index: 2, part_count: 2, final_sha256: fullFinalSha }
        ];

        const groups = groupMultipart(inputFiles);

        expect(groups[0].final_sha256).toBe(fullFinalSha);
        expect(groups[0].parts[0].sha256).toBe(fullSha1);
        expect(groups[0].parts[1].sha256).toBe(fullSha2);
    });
});
