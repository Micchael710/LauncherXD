import { describe, test, expect } from 'vitest';
import {
    MULTIPART_CHUNK_SIZE,
    calculatePartCount,
    processReleaseAsset,
    formatMultipartPath,
    validateAssetPaths
} from '../utils/releaseAssetProcessor';

describe('releaseAssetProcessor Utility', () => {
    test('1. constant MULTIPART_CHUNK_SIZE is exactly 1 GiB (1073741824 bytes)', () => {
        expect(MULTIPART_CHUNK_SIZE).toBe(1024 * 1024 * 1024);
        expect(MULTIPART_CHUNK_SIZE).toBe(1073741824);
    });

    test('1b. calculatePartCount computes accurate numerical partition counts without allocating buffers', () => {
        const ONE_GIB = 1024 * 1024 * 1024; // 1,073,741,824 bytes

        // 0 bytes -> 0
        expect(calculatePartCount(0)).toBe(0);
        expect(calculatePartCount(-10)).toBe(0);

        // 1 GiB - 1 (1,073,741,823 bytes) -> 1 part
        expect(calculatePartCount(ONE_GIB - 1)).toBe(1);

        // 1 GiB exact (1,073,741,824 bytes) -> 1 part
        expect(calculatePartCount(ONE_GIB)).toBe(1);

        // 1 GiB + 1 (1,073,741,825 bytes) -> 2 parts
        expect(calculatePartCount(ONE_GIB + 1)).toBe(2);

        // 5 GiB exact (5,368,709,120 bytes) -> 5 parts
        expect(calculatePartCount(5 * ONE_GIB)).toBe(5);

        // 6,404,005,561 bytes (~5.96 GiB) -> exactly 6 parts
        const bigFileSize = 6404005561;
        const partCount = calculatePartCount(bigFileSize);
        expect(partCount).toBe(6);

        // Verify part size distribution: 5 full 1 GiB parts + 1 remaining part of 1,035,296,441 bytes
        const fullPartsSize = 5 * ONE_GIB;
        const remainderSize = bigFileSize - fullPartsSize;
        expect(remainderSize).toBe(1035296441);
        expect(remainderSize).toBeLessThan(ONE_GIB);

        // Invalid chunk size throws
        expect(() => calculatePartCount(100, 0)).toThrow(/Invalid chunkSize: 0/);
        expect(() => calculatePartCount(100, -1)).toThrow(/Invalid chunkSize: -1/);
        expect(() => calculatePartCount(100, Infinity)).toThrow(/Invalid chunkSize: Infinity/);
        expect(() => calculatePartCount(100, 1.5)).toThrow(/Invalid chunkSize: 1.5/);
    });

    test('2. formatMultipartPath formats paths deterministically with minimum 3-digit zero padding', () => {
        expect(formatMultipartPath('mods/optifine.jar', 1, 3)).toBe('mods/optifine.jar.part-001-of-003');
        expect(formatMultipartPath('mods/optifine.jar', 2, 3)).toBe('mods/optifine.jar.part-002-of-003');
        expect(formatMultipartPath('mods/optifine.jar', 3, 3)).toBe('mods/optifine.jar.part-003-of-003');

        // When partCount >= 1000, padding matches count length
        expect(formatMultipartPath('game.zip', 5, 1200)).toBe('game.zip.part-0005-of-1200');
        expect(formatMultipartPath('game.zip', 1200, 1200)).toBe('game.zip.part-1200-of-1200');
    });

    test('3. validateAssetPaths enforces safe relative paths without traversal or backslashes', () => {
        expect(validateAssetPaths('client/launcher.exe', 'client/launcher.exe')).toBeNull();

        expect(validateAssetPaths('', 'client/launcher.exe')).toContain('Path is required');
        expect(validateAssetPaths('client/launcher.exe', '')).toContain('Logical path is required');
        expect(validateAssetPaths('client\\launcher.exe', 'client/launcher.exe')).toContain('backslashes');
        expect(validateAssetPaths('/client/launcher.exe', 'client/launcher.exe')).toContain('relative');
        expect(validateAssetPaths('C:/client/launcher.exe', 'client/launcher.exe')).toContain('relative');
        expect(validateAssetPaths('../client/launcher.exe', 'client/launcher.exe')).toContain('traversal');
        expect(validateAssetPaths('client/./launcher.exe', 'client/launcher.exe')).toContain('traversal');
    });

    test('4. small file (<= chunkSize) generates a single standalone asset without multipart metadata', async () => {
        const content = '1234567890'; // 10 bytes
        const blob = new Blob([content], { type: 'text/plain' });
        const expectedSha = 'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646';

        const plan = await processReleaseAsset(blob, 'test/small.txt', 'test/small.txt', 'add', {
            chunkSize: 1024
        });

        expect(plan.isMultipart).toBe(false);
        expect(plan.fileSize).toBe(10);
        expect(plan.partCount).toBe(1);
        expect(plan.finalSha256).toBe(expectedSha);
        expect(plan.parts.length).toBe(1);

        const part = plan.parts[0];
        expect(part.path).toBe('test/small.txt');
        expect(part.logical_path).toBe('test/small.txt');
        expect(part.operation).toBe('add');
        expect(part.size).toBe(10);
        expect(part.sha256).toBe(expectedSha);
        expect(part.part_index).toBeUndefined();
        expect(part.part_count).toBeUndefined();
        expect(part.final_sha256).toBeUndefined();
        expect('filename' in part).toBe(false);
    });

    test('5. file of size exactly equal to chunkSize remains a single standalone asset', async () => {
        const content = '1234567890'; // 10 bytes
        const blob = new Blob([content]);

        const plan = await processReleaseAsset(blob, 'exact.bin', 'exact.bin', 'replace', {
            chunkSize: 10
        });

        expect(plan.isMultipart).toBe(false);
        expect(plan.partCount).toBe(1);
        expect(plan.parts.length).toBe(1);
        expect(plan.parts[0].path).toBe('exact.bin');
        expect(plan.parts[0].part_index).toBeUndefined();
    });

    test('6. file of size (chunkSize + 1) generates exactly two multipart parts with correct metadata and hashes', async () => {
        // 10 bytes part 1 + 5 bytes part 2 = 15 bytes total
        const p1 = '1234567890';
        const p2 = 'abcde';
        const fullContent = p1 + p2;
        const blob = new Blob([fullContent]);

        const p1ExpectedSha = 'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646';
        const p2ExpectedSha = '36bbe50ed96841d10443bcb670d6554f0a34b761be67ec9c4a8ad2c0c44ca42c';
        const fullExpectedSha = 'cbfb1b82064f6699965f47368a6f95b386d0c8757c5c1c005e44c938377c029f';

        const plan = await processReleaseAsset(blob, 'mods/large.jar', 'mods/large.jar', 'add', {
            chunkSize: 10,
            subChunkSize: 5
        });

        expect(plan.isMultipart).toBe(true);
        expect(plan.fileSize).toBe(15);
        expect(plan.partCount).toBe(2);
        expect(plan.finalSha256).toBe(fullExpectedSha);
        expect(plan.parts.length).toBe(2);

        // Part 1
        expect(plan.parts[0].path).toBe('mods/large.jar.part-001-of-002');
        expect(plan.parts[0].logical_path).toBe('mods/large.jar');
        expect(plan.parts[0].operation).toBe('add');
        expect(plan.parts[0].size).toBe(10);
        expect(plan.parts[0].sha256).toBe(p1ExpectedSha);
        expect(plan.parts[0].part_index).toBe(1);
        expect(plan.parts[0].part_count).toBe(2);
        expect(plan.parts[0].final_sha256).toBe(fullExpectedSha);
        expect('filename' in plan.parts[0]).toBe(false);

        // Part 2
        expect(plan.parts[1].path).toBe('mods/large.jar.part-002-of-002');
        expect(plan.parts[1].logical_path).toBe('mods/large.jar');
        expect(plan.parts[1].operation).toBe('add');
        expect(plan.parts[1].size).toBe(5);
        expect(plan.parts[1].sha256).toBe(p2ExpectedSha);
        expect(plan.parts[1].part_index).toBe(2);
        expect(plan.parts[1].part_count).toBe(2);
        expect(plan.parts[1].final_sha256).toBe(fullExpectedSha);
        expect('filename' in plan.parts[1]).toBe(false);
    });

    test('7. progress callback fires incrementally from 0 to 100%', async () => {
        const content = '1234567890abcdefghijklmnopqrstuvwxyz'; // 36 bytes
        const blob = new Blob([content]);
        const progressValues: number[] = [];

        await processReleaseAsset(blob, 'progress.bin', 'progress.bin', 'add', {
            chunkSize: 10,
            subChunkSize: 5,
            onProgress: (p) => progressValues.push(p)
        });

        expect(progressValues.length).toBeGreaterThan(0);
        expect(progressValues[progressValues.length - 1]).toBe(100);
        // Verify monotonically non-decreasing
        for (let i = 1; i < progressValues.length; i++) {
            expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
        }
    });

    test('8. empty file (0 bytes) is handled safely as single standalone asset', async () => {
        const emptyBlob = new Blob([]);
        const emptySha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

        const plan = await processReleaseAsset(emptyBlob, 'empty.txt', 'empty.txt', 'add');

        expect(plan.isMultipart).toBe(false);
        expect(plan.fileSize).toBe(0);
        expect(plan.partCount).toBe(1);
        expect(plan.finalSha256).toBe(emptySha);
        expect(plan.parts.length).toBe(1);
        expect(plan.parts[0].size).toBe(0);
        expect(plan.parts[0].sha256).toBe(emptySha);
    });

    test('9. rejects quickly when chunkSize is invalid (0, negative, Infinity)', async () => {
        const blob = new Blob(['test content']);

        await expect(
            processReleaseAsset(blob, 'file.txt', 'file.txt', 'add', { chunkSize: 0 })
        ).rejects.toThrow(/Invalid chunkSize: 0/);

        await expect(
            processReleaseAsset(blob, 'file.txt', 'file.txt', 'add', { chunkSize: -1 })
        ).rejects.toThrow(/Invalid chunkSize: -1/);

        await expect(
            processReleaseAsset(blob, 'file.txt', 'file.txt', 'add', { chunkSize: Infinity })
        ).rejects.toThrow(/Invalid chunkSize: Infinity/);
    });

    test('10. rejects quickly when subChunkSize is invalid (0, negative, Infinity)', async () => {
        const blob = new Blob(['test content']);

        await expect(
            processReleaseAsset(blob, 'file.txt', 'file.txt', 'add', { subChunkSize: 0 })
        ).rejects.toThrow(/Invalid subChunkSize: 0/);

        await expect(
            processReleaseAsset(blob, 'file.txt', 'file.txt', 'add', { subChunkSize: -1 })
        ).rejects.toThrow(/Invalid subChunkSize: -1/);

        await expect(
            processReleaseAsset(blob, 'file.txt', 'file.txt', 'add', { subChunkSize: Infinity })
        ).rejects.toThrow(/Invalid subChunkSize: Infinity/);
    });
});
