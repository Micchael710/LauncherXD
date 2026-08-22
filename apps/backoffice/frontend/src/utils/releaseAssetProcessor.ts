import { createSHA256 } from 'hash-wasm';
import type { ReleaseFileOperation } from '../types/releaseFiles';

/**
 * Single partition chunk limit: 1 GiB = 1024 * 1024 * 1024 bytes (1,073,741,824 bytes).
 */
export const MULTIPART_CHUNK_SIZE = 1024 * 1024 * 1024;

/**
 * Sub-chunk buffer size for memory-safe stream hashing (2 MiB).
 */
export const DEFAULT_SUB_CHUNK_SIZE = 2 * 1024 * 1024;

/**
 * Computes deterministic number of multipart parts for a given file size and chunk size.
 */
export function calculatePartCount(fileSize: number, chunkSize: number = MULTIPART_CHUNK_SIZE): number {
    if (!Number.isFinite(fileSize) || fileSize <= 0) return 0;
    if (!Number.isFinite(chunkSize) || !Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new Error(`Invalid chunkSize: ${chunkSize}. chunkSize must be a positive finite integer.`);
    }
    return Math.ceil(fileSize / chunkSize);
}

export interface AssetPartPlan {
    blob: Blob;
    path: string;
    logical_path: string;
    operation: ReleaseFileOperation;
    size: number;
    sha256: string;
    part_index?: number;
    part_count?: number;
    final_sha256?: string;
}

export interface AssetProcessingPlan {
    isMultipart: boolean;
    filename: string;
    fileSize: number;
    partCount: number;
    finalSha256: string;
    parts: AssetPartPlan[];
}

export interface AssetProcessorOptions {
    chunkSize?: number;
    subChunkSize?: number;
    onProgress?: (progressPercent: number) => void;
}

/**
 * Validates path security rules for release files:
 * - Must not be empty
 * - Must not contain backslashes
 * - Must not be absolute (/ or drive letters like C:)
 * - Must not contain traversal segments (. or ..)
 */
export function validateAssetPaths(path: string, logicalPath: string): string | null {
    const p = path.trim();
    const lp = logicalPath.trim();

    if (!p) return 'Path is required.';
    if (!lp) return 'Logical path is required.';

    if (p.includes('\\') || lp.includes('\\')) {
        return 'Paths must not contain backslashes. Use forward slashes (/) instead.';
    }

    if (p.startsWith('/') || lp.startsWith('/') || /^[a-zA-Z]:/.test(p) || /^[a-zA-Z]:/.test(lp)) {
        return 'Paths must be relative and cannot start with a slash or drive letter.';
    }

    const pSegments = p.split('/');
    const lpSegments = lp.split('/');

    if (pSegments.some((s) => s === '..' || s === '.') || lpSegments.some((s) => s === '..' || s === '.')) {
        return 'Paths must not contain directory traversal segments (. or ..).';
    }

    return null;
}

/**
 * Formats multipart part path deterministically:
 * <userPath>.part-<INDEX>-of-<COUNT> with zero-padding (min 3 digits).
 */
export function formatMultipartPath(userPath: string, partIndex: number, partCount: number): string {
    const padLen = Math.max(3, String(partCount).length);
    const pad = (n: number) => String(n).padStart(padLen, '0');
    return `${userPath}.part-${pad(partIndex)}-of-${pad(partCount)}`;
}

/**
 * Processes a release file incrementally:
 * - Chunks large files (> chunkSize) into multipart partitions.
 * - Files <= chunkSize remain single standalone assets.
 * - Streams chunks to calculate incremental SHA-256 for overall file and each part.
 * - Never loads entire files into memory.
 */
export async function processReleaseAsset(
    file: File | Blob,
    userPath: string,
    userLogicalPath: string,
    operation: ReleaseFileOperation,
    options?: AssetProcessorOptions
): Promise<AssetProcessingPlan> {
    const pathError = validateAssetPaths(userPath, userLogicalPath);
    if (pathError) {
        throw new Error(pathError);
    }

    const totalSize = file.size;
    const chunkSize = options?.chunkSize ?? MULTIPART_CHUNK_SIZE;
    const subChunkSize = options?.subChunkSize ?? DEFAULT_SUB_CHUNK_SIZE;

    if (!Number.isFinite(chunkSize) || !Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new Error(`Invalid chunkSize: ${chunkSize}. chunkSize must be a positive finite integer.`);
    }

    if (!Number.isFinite(subChunkSize) || !Number.isInteger(subChunkSize) || subChunkSize <= 0) {
        throw new Error(`Invalid subChunkSize: ${subChunkSize}. subChunkSize must be a positive finite integer.`);
    }

    const filename = file instanceof File ? file.name : (userPath.split('/').pop() || 'asset.bin');

    const isMultipart = totalSize > chunkSize;
    const partCount = isMultipart ? Math.ceil(totalSize / chunkSize) : 1;

    const globalHasher = await createSHA256();
    globalHasher.init();

    const rawParts: Array<{
        blob: Blob;
        path: string;
        logical_path: string;
        operation: ReleaseFileOperation;
        size: number;
        sha256: string;
        part_index?: number;
        part_count?: number;
    }> = [];

    let totalBytesHashed = 0;

    for (let i = 0; i < partCount; i++) {
        const partIndex = i + 1;
        const startOffset = i * chunkSize;
        const endOffset = Math.min(totalSize, (i + 1) * chunkSize);
        const partBlob = file.slice(startOffset, endOffset);
        const partSize = endOffset - startOffset;

        const partHasher = await createSHA256();
        partHasher.init();

        if (partSize === 0) {
            // Empty file / blob
            const partSha = partHasher.digest('hex');
            const partPath = isMultipart ? formatMultipartPath(userPath, partIndex, partCount) : userPath;
            rawParts.push({
                blob: partBlob,
                path: partPath,
                logical_path: userLogicalPath,
                operation,
                size: 0,
                sha256: partSha,
                ...(isMultipart ? { part_index: partIndex, part_count: partCount } : {})
            });
        } else {
            // Process part in sub-chunks
            for (let subOffset = 0; subOffset < partSize; subOffset += subChunkSize) {
                const subEnd = Math.min(partSize, subOffset + subChunkSize);
                const subBlob = partBlob.slice(subOffset, subEnd);
                const buffer = await subBlob.arrayBuffer();
                const uint8 = new Uint8Array(buffer);

                globalHasher.update(uint8);
                partHasher.update(uint8);

                totalBytesHashed += uint8.byteLength;
                if (totalSize > 0 && options?.onProgress) {
                    const percent = Math.min(100, Math.round((totalBytesHashed / totalSize) * 100));
                    options.onProgress(percent);
                }
            }

            const partSha = partHasher.digest('hex');
            const partPath = isMultipart ? formatMultipartPath(userPath, partIndex, partCount) : userPath;

            rawParts.push({
                blob: partBlob,
                path: partPath,
                logical_path: userLogicalPath,
                operation,
                size: partSize,
                sha256: partSha,
                ...(isMultipart ? { part_index: partIndex, part_count: partCount } : {})
            });
        }
    }

    const finalSha256 = globalHasher.digest('hex');

    // Finalize parts
    const finalParts: AssetPartPlan[] = rawParts.map((rp) => {
        if (isMultipart) {
            return {
                ...rp,
                final_sha256: finalSha256
            };
        }
        return {
            blob: rp.blob,
            path: rp.path,
            logical_path: rp.logical_path,
            operation: rp.operation,
            size: rp.size,
            sha256: rp.sha256
        };
    });

    options?.onProgress?.(100);

    return {
        isMultipart,
        filename,
        fileSize: totalSize,
        partCount,
        finalSha256,
        parts: finalParts
    };
}
