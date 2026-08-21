import React, { useState, useEffect } from 'react';
import type { CreateReleaseFileInput, UpdateReleaseFileInput, ReleaseFile, ReleaseFileOperation } from '../types/releaseFiles';
import { InspectApi } from '../api/inspect';
import { formatApiErrorMessage } from '../api/client';

export interface ReleaseFileFormProps {
    initialData?: ReleaseFile | null;
    onSubmit: (input: CreateReleaseFileInput | UpdateReleaseFileInput) => Promise<void>;
    onCancel?: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
}

export const ReleaseFileForm: React.FC<ReleaseFileFormProps> = ({
    initialData = null,
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel
}) => {
    const isEdit = Boolean(initialData);

    const [path, setPath] = useState(initialData?.path || '');
    const [logicalPath, setLogicalPath] = useState(initialData?.logical_path || '');
    const [operation, setOperation] = useState<ReleaseFileOperation>(initialData?.operation || 'add');
    const [size, setSize] = useState<string>(initialData?.size != null ? initialData.size.toString() : '');
    const [sha256, setSha256] = useState(initialData?.sha256 || '');
    const [partIndex, setPartIndex] = useState<string>(initialData?.part_index != null ? initialData.part_index.toString() : '');
    const [partCount, setPartCount] = useState<string>(initialData?.part_count != null ? initialData.part_count.toString() : '');
    const [finalSha256, setFinalSha256] = useState(initialData?.final_sha256 || '');

    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectError, setInspectError] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setPath(initialData.path || '');
            setLogicalPath(initialData.logical_path || '');
            setOperation(initialData.operation || 'add');
            setSize(initialData.size != null ? initialData.size.toString() : '');
            setSha256(initialData.sha256 || '');
            setPartIndex(initialData.part_index != null ? initialData.part_index.toString() : '');
            setPartCount(initialData.part_count != null ? initialData.part_count.toString() : '');
            setFinalSha256(initialData.final_sha256 || '');
        }
    }, [initialData]);

    const handleFileInspect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsInspecting(true);
        setInspectError(null);

        try {
            const result = await InspectApi.inspectLocalFile(file);
            setSize(result.size.toString());
            setSha256(result.sha256);

            if (!path.trim()) {
                setPath(result.filename);
            }
            if (!logicalPath.trim()) {
                setLogicalPath(result.filename);
            }
        } catch (err: unknown) {
            setInspectError(formatApiErrorMessage(err));
        } finally {
            setIsInspecting(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!path.trim()) {
            setLocalError('Path is required.');
            return;
        }
        if (!logicalPath.trim()) {
            setLocalError('Logical path is required.');
            return;
        }

        const parsedSize = Number(size);
        if (isNaN(parsedSize) || parsedSize < 0) {
            setLocalError('Size must be a non-negative number.');
            return;
        }

        if (operation === 'add' || operation === 'replace') {
            if (!sha256 || !/^[a-fA-F0-9]{64}$/.test(sha256)) {
                setLocalError('SHA-256 is required and must be 64 hexadecimal characters for add/replace operations.');
                return;
            }
        }

        let parsedPartIndex: number | undefined;
        let parsedPartCount: number | undefined;

        if (partIndex.trim() !== '') {
            parsedPartIndex = Number(partIndex);
            if (isNaN(parsedPartIndex) || parsedPartIndex < 1) {
                setLocalError('Part index must be at least 1.');
                return;
            }

            if (partCount.trim() === '') {
                setLocalError('Part count is required when part index is specified.');
                return;
            }

            parsedPartCount = Number(partCount);
            if (isNaN(parsedPartCount) || parsedPartCount < 1) {
                setLocalError('Part count must be at least 1.');
                return;
            }

            if (parsedPartIndex > parsedPartCount) {
                setLocalError('Part index cannot exceed part count.');
                return;
            }
        } else if (partCount.trim() !== '') {
            parsedPartCount = Number(partCount);
            if (isNaN(parsedPartCount) || parsedPartCount < 1) {
                setLocalError('Part count must be at least 1.');
                return;
            }
        }

        if (isEdit && initialData) {
            if (initialData.part_index !== undefined && initialData.part_index !== null && partIndex.trim() === '') {
                setLocalError('The current API does not allow clearing part index on edit. Please keep the existing value or delete and recreate the Release File.');
                return;
            }
            if (initialData.part_count !== undefined && initialData.part_count !== null && partCount.trim() === '') {
                setLocalError('The current API does not allow clearing part count on edit. Please keep the existing value or delete and recreate the Release File.');
                return;
            }
            if (initialData.final_sha256 && initialData.final_sha256.length > 0 && finalSha256.trim() === '') {
                setLocalError('The current API does not allow clearing final SHA-256 on edit. Please keep the existing value or delete and recreate the Release File.');
                return;
            }

            const partialPayload: UpdateReleaseFileInput = {};

            if (path.trim() !== initialData.path) {
                partialPayload.path = path.trim();
            }
            if (logicalPath.trim() !== initialData.logical_path) {
                partialPayload.logical_path = logicalPath.trim();
            }
            if (operation !== initialData.operation) {
                partialPayload.operation = operation;
            }
            if (parsedSize !== initialData.size) {
                partialPayload.size = parsedSize;
            }

            const normSha = sha256.trim() || undefined;
            const initialSha = initialData.sha256 || undefined;
            if (normSha !== initialSha) {
                partialPayload.sha256 = normSha;
            }

            const initialPartIndex = (initialData.part_index !== undefined && initialData.part_index !== null) ? initialData.part_index : undefined;
            if (parsedPartIndex !== initialPartIndex) {
                partialPayload.part_index = parsedPartIndex;
            }

            const initialPartCount = (initialData.part_count !== undefined && initialData.part_count !== null) ? initialData.part_count : undefined;
            if (parsedPartCount !== initialPartCount) {
                partialPayload.part_count = parsedPartCount;
            }

            const normFinalSha = finalSha256.trim() || undefined;
            const initialFinalSha = (initialData.final_sha256 && initialData.final_sha256.length > 0) ? initialData.final_sha256 : undefined;
            if (normFinalSha !== initialFinalSha) {
                partialPayload.final_sha256 = normFinalSha;
            }

            if (Object.keys(partialPayload).length === 0) {
                onCancel?.();
                return;
            }

            try {
                await onSubmit(partialPayload);
            } catch {
                // Parent handles error message
            }
            return;
        }

        const input: CreateReleaseFileInput = {
            path: path.trim(),
            logical_path: logicalPath.trim(),
            operation,
            size: parsedSize,
            sha256: sha256.trim() || undefined,
            part_index: parsedPartIndex,
            part_count: parsedPartCount,
            final_sha256: finalSha256.trim() || undefined
        };

        try {
            await onSubmit(input);
            setPath('');
            setLogicalPath('');
            setOperation('add');
            setSize('');
            setSha256('');
            setPartIndex('');
            setPartCount('');
            setFinalSha256('');
            setLocalError(null);
            setInspectError(null);
        } catch {
            // Parent handles error message
        }
    };

    const displayError = localError || inspectError;
    const defaultSubmitLabel = isEdit ? 'Save Changes' : 'Add File';
    const formTitle = isEdit ? `Edit Release File: ${initialData?.filename || initialData?.path}` : 'Add Release File';

    return (
        <form onSubmit={handleSubmit} className="form-card" aria-label={isEdit ? 'Edit Release File Form' : 'Add Release File Form'}>
            <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
                <h3 className="card-title">{formTitle}</h3>
                {isEdit && onCancel && (
                    <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn btn-secondary btn-sm">
                        Cancel
                    </button>
                )}
            </div>

            {displayError && (
                <div role="alert" className="alert alert-danger">
                    {displayError}
                </div>
            )}

            <div className="card" style={{ backgroundColor: '#f8fafc', marginBottom: '1.25rem', borderStyle: 'dashed' }}>
                <label htmlFor="local-file-inspect" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong>Local SHA-256 Inspector (Max 50MB):</strong>
                </label>
                <input
                    id="local-file-inspect"
                    type="file"
                    onChange={handleFileInspect}
                    disabled={isInspecting || isSubmitting}
                    aria-label="Inspect local file"
                    className="form-control"
                    style={{ backgroundColor: '#ffffff' }}
                />
                {isInspecting && <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', marginTop: '0.25rem', display: 'inline-block' }}>Inspecting file...</span>}
            </div>

            <div className="form-group">
                <label htmlFor="file-path" className="form-label">Path (e.g. mods/optifine.jar):</label>
                <input
                    id="file-path"
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="file-logical-path" className="form-label">Logical Path (e.g. mods/optifine.jar):</label>
                <input
                    id="file-logical-path"
                    type="text"
                    value={logicalPath}
                    onChange={(e) => setLogicalPath(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    required
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                    <label htmlFor="file-operation" className="form-label">Operation:</label>
                    <select
                        id="file-operation"
                        value={operation}
                        onChange={(e) => setOperation(e.target.value as ReleaseFileOperation)}
                        disabled={isSubmitting}
                        className="form-control"
                    >
                        <option value="add">add</option>
                        <option value="replace">replace</option>
                        <option value="delete">delete</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="file-size" className="form-label">Size (bytes):</label>
                    <input
                        id="file-size"
                        type="number"
                        min="0"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        required
                    />
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="file-sha256" className="form-label">
                    SHA-256 (64 hex characters):
                </label>
                <input
                    id="file-sha256"
                    type="text"
                    value={sha256}
                    onChange={(e) => setSha256(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    style={{ fontFamily: 'monospace' }}
                    placeholder={operation === 'delete' ? 'Optional for delete' : 'Required for add/replace'}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                    <label htmlFor="file-part-index" className="form-label">Part Index (optional):</label>
                    <input
                        id="file-part-index"
                        type="number"
                        min="1"
                        value={partIndex}
                        onChange={(e) => setPartIndex(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        placeholder="e.g. 1"
                    />
                </div>
                <div>
                    <label htmlFor="file-part-count" className="form-label">Part Count (optional):</label>
                    <input
                        id="file-part-count"
                        type="number"
                        min="1"
                        value={partCount}
                        onChange={(e) => setPartCount(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        placeholder="e.g. 2"
                    />
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="file-final-sha256" className="form-label">Final SHA-256 (for multipart, optional):</label>
                <input
                    id="file-final-sha256"
                    type="text"
                    value={finalSha256}
                    onChange={(e) => setFinalSha256(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="SHA-256 of the assembled complete file"
                />
            </div>

            <div className="form-actions">
                <button
                    type="submit"
                    disabled={isSubmitting || isInspecting}
                    className="btn btn-primary"
                >
                    {isSubmitting ? 'Saving...' : (submitLabel || defaultSubmitLabel)}
                </button>
                {isEdit && onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};
