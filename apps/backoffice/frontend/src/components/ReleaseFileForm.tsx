import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type {
    CreateReleaseFileInput,
    UpdateReleaseFileInput,
    ReleaseFile,
    ReleaseFileOperation
} from '../types/releaseFiles';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { formatApiErrorMessage } from '../api/client';
import {
    processReleaseAsset,
    validateAssetPaths,
    formatMultipartPath,
    type AssetProcessingPlan
} from '../utils/releaseAssetProcessor';

export interface ReleaseFileFormProps {
    releaseId?: string;
    initialData?: ReleaseFile | null;
    onSubmit?: (input: CreateReleaseFileInput | UpdateReleaseFileInput) => Promise<void>;
    onSuccess?: () => Promise<void> | void;
    onCancel?: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
    chunkSize?: number;
}

export const ReleaseFileForm: React.FC<ReleaseFileFormProps> = ({
    releaseId: propReleaseId,
    initialData = null,
    onSubmit,
    onSuccess,
    onCancel,
    isSubmitting = false,
    submitLabel,
    chunkSize
}) => {
    const { id: routeReleaseId } = useParams<{ id: string }>();
    const effectiveReleaseId = propReleaseId || routeReleaseId;
    const isEdit = Boolean(initialData);

    // Common form fields
    const [path, setPath] = useState(initialData?.path || '');
    const [logicalPath, setLogicalPath] = useState(initialData?.logical_path || '');
    const [operation, setOperation] = useState<ReleaseFileOperation>(initialData?.operation || 'add');

    // Edit Mode technical fields
    const [editSize, setEditSize] = useState<string>(initialData?.size != null ? initialData.size.toString() : '');
    const [editSha256, setEditSha256] = useState(initialData?.sha256 || '');
    const [editPartIndex, setEditPartIndex] = useState<string>(initialData?.part_index != null ? initialData.part_index.toString() : '');
    const [editPartCount, setEditPartCount] = useState<string>(initialData?.part_count != null ? initialData.part_count.toString() : '');
    const [editFinalSha256, setEditFinalSha256] = useState(initialData?.final_sha256 || '');

    // Create Mode automatic processing states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState<number>(0);
    const [plan, setPlan] = useState<AssetProcessingPlan | null>(null);

    // Execution & Progress state
    const [isProcessing, setIsProcessing] = useState(false);
    const [processStage, setProcessStage] = useState<'idle' | 'registering' | 'uploading' | 'verifying'>('idle');
    const [currentPartNum, setCurrentPartNum] = useState<number>(0);
    const [totalPartsNum, setTotalPartsNum] = useState<number>(0);
    const [currentPartPath, setCurrentPartPath] = useState<string>('');
    const [uploadPercent, setUploadPercent] = useState<number>(0);

    // Messages
    const [localError, setLocalError] = useState<string | null>(null);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setPath(initialData.path || '');
            setLogicalPath(initialData.logical_path || '');
            setOperation(initialData.operation || 'add');
            setEditSize(initialData.size != null ? initialData.size.toString() : '');
            setEditSha256(initialData.sha256 || '');
            setEditPartIndex(initialData.part_index != null ? initialData.part_index.toString() : '');
            setEditPartCount(initialData.part_count != null ? initialData.part_count.toString() : '');
            setEditFinalSha256(initialData.final_sha256 || '');
        }
    }, [initialData]);

    const runFileAnalysis = useCallback(async (file: File, userPath: string, userLogicalPath: string, op: ReleaseFileOperation) => {
        setIsAnalyzing(true);
        setAnalysisProgress(0);
        setLocalError(null);
        try {
            const result = await processReleaseAsset(
                file,
                userPath,
                userLogicalPath,
                op,
                {
                    chunkSize,
                    onProgress: (p) => setAnalysisProgress(p)
                }
            );
            setPlan(result);
        } catch (err: unknown) {
            setLocalError(err instanceof Error ? err.message : 'Error analyzing file SHA-256');
            setPlan(null);
        } finally {
            setIsAnalyzing(false);
        }
    }, [chunkSize]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setSuccessNotice(null);
        setLocalError(null);

        const newPath = path.trim() || file.name;
        const newLogicalPath = logicalPath.trim() || file.name;

        if (!path.trim()) setPath(newPath);
        if (!logicalPath.trim()) setLogicalPath(newLogicalPath);

        if (operation !== 'delete') {
            await runFileAnalysis(file, newPath, newLogicalPath, operation);
        }
    };

    const handlePathChange = (newPath: string) => {
        setPath(newPath);
        if (plan && operation !== 'delete') {
            const updatedParts = plan.parts.map((p, idx) => ({
                ...p,
                path: plan.isMultipart ? formatMultipartPath(newPath, idx + 1, plan.partCount) : newPath
            }));
            setPlan({ ...plan, parts: updatedParts });
        }
    };

    const handleLogicalPathChange = (newLogicalPath: string) => {
        setLogicalPath(newLogicalPath);
        if (plan && operation !== 'delete') {
            const updatedParts = plan.parts.map((p) => ({
                ...p,
                logical_path: newLogicalPath
            }));
            setPlan({ ...plan, parts: updatedParts });
        }
    };

    const handleOperationChange = (newOp: ReleaseFileOperation) => {
        setOperation(newOp);
        setLocalError(null);
        if (newOp === 'delete') {
            setPlan(null);
        } else if (selectedFile) {
            runFileAnalysis(selectedFile, path || selectedFile.name, logicalPath || selectedFile.name, newOp);
        }
    };

    // ==========================================
    // SUBMIT HANDLER FOR EDIT MODE
    // ==========================================
    const handleEditSubmit = async (e: React.FormEvent) => {
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

        const parsedSize = Number(editSize);
        if (isNaN(parsedSize) || parsedSize < 0) {
            setLocalError('Size must be a non-negative number.');
            return;
        }

        if (operation === 'add' || operation === 'replace') {
            if (!editSha256 || !/^[a-fA-F0-9]{64}$/.test(editSha256)) {
                setLocalError('SHA-256 is required and must be 64 hexadecimal characters for add/replace operations.');
                return;
            }
        }

        let parsedPartIndex: number | undefined;
        let parsedPartCount: number | undefined;

        if (editPartIndex.trim() !== '') {
            parsedPartIndex = Number(editPartIndex);
            if (isNaN(parsedPartIndex) || parsedPartIndex < 1) {
                setLocalError('Part index must be at least 1.');
                return;
            }
            if (editPartCount.trim() === '') {
                setLocalError('Part count is required when part index is specified.');
                return;
            }
            parsedPartCount = Number(editPartCount);
            if (isNaN(parsedPartCount) || parsedPartCount < 1) {
                setLocalError('Part count must be at least 1.');
                return;
            }
            if (parsedPartIndex > parsedPartCount) {
                setLocalError('Part index cannot exceed part count.');
                return;
            }
        } else if (editPartCount.trim() !== '') {
            parsedPartCount = Number(editPartCount);
            if (isNaN(parsedPartCount) || parsedPartCount < 1) {
                setLocalError('Part count must be at least 1.');
                return;
            }
        }

        if (initialData) {
            if (initialData.part_index !== undefined && initialData.part_index !== null && editPartIndex.trim() === '') {
                setLocalError('The current API does not allow clearing part index on edit. Please keep the existing value or delete and recreate the Release File.');
                return;
            }
            if (initialData.part_count !== undefined && initialData.part_count !== null && editPartCount.trim() === '') {
                setLocalError('The current API does not allow clearing part count on edit. Please keep the existing value or delete and recreate the Release File.');
                return;
            }
            if (initialData.final_sha256 && initialData.final_sha256.length > 0 && editFinalSha256.trim() === '') {
                setLocalError('The current API does not allow clearing final SHA-256 on edit. Please keep the existing value or delete and recreate the Release File.');
                return;
            }

            const partialPayload: UpdateReleaseFileInput = {};

            if (path.trim() !== initialData.path) partialPayload.path = path.trim();
            if (logicalPath.trim() !== initialData.logical_path) partialPayload.logical_path = logicalPath.trim();
            if (operation !== initialData.operation) partialPayload.operation = operation;
            if (parsedSize !== initialData.size) partialPayload.size = parsedSize;

            const normSha = editSha256.trim() || undefined;
            if (normSha !== (initialData.sha256 || undefined)) partialPayload.sha256 = normSha;

            const initialPartIndex = (initialData.part_index !== undefined && initialData.part_index !== null) ? initialData.part_index : undefined;
            if (parsedPartIndex !== initialPartIndex) partialPayload.part_index = parsedPartIndex;

            const initialPartCount = (initialData.part_count !== undefined && initialData.part_count !== null) ? initialData.part_count : undefined;
            if (parsedPartCount !== initialPartCount) partialPayload.part_count = parsedPartCount;

            const normFinalSha = editFinalSha256.trim() || undefined;
            const initialFinalSha = (initialData.final_sha256 && initialData.final_sha256.length > 0) ? initialData.final_sha256 : undefined;
            if (normFinalSha !== initialFinalSha) partialPayload.final_sha256 = normFinalSha;

            if (Object.keys(partialPayload).length === 0) {
                onCancel?.();
                return;
            }

            try {
                if (onSubmit) {
                    await onSubmit(partialPayload);
                } else if (effectiveReleaseId && initialData.id) {
                    await ReleaseFilesApi.updateReleaseFile(effectiveReleaseId, initialData.id, partialPayload);
                    await onSuccess?.();
                }
            } catch {
                // Parent handles error message
            }
        }
    };

    // ==========================================
    // SUBMIT HANDLER FOR CREATE MODE (AUTOMATIC)
    // ==========================================
    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        setSuccessNotice(null);

        const pathErr = validateAssetPaths(path, logicalPath);
        if (pathErr) {
            setLocalError(pathErr);
            return;
        }

        // Operation === 'delete'
        if (operation === 'delete') {
            setIsProcessing(true);
            try {
                const deleteInput: CreateReleaseFileInput = {
                    path: path.trim(),
                    logical_path: logicalPath.trim(),
                    operation: 'delete',
                    size: 0
                };

                if (onSubmit) {
                    await onSubmit(deleteInput);
                } else if (effectiveReleaseId) {
                    await ReleaseFilesApi.createReleaseFile(effectiveReleaseId, deleteInput);
                    await onSuccess?.();
                }

                setPath('');
                setLogicalPath('');
                setOperation('add');
                setSelectedFile(null);
                setPlan(null);
                setSuccessNotice('Delete file record created successfully.');
            } catch (err: unknown) {
                setLocalError(formatApiErrorMessage(err));
            } finally {
                setIsProcessing(false);
            }
            return;
        }

        // Operation === 'add' | 'replace'
        if (!selectedFile) {
            setLocalError('Please select a file to process and upload.');
            return;
        }

        if (isAnalyzing) {
            setLocalError('Please wait for SHA-256 analysis to finish.');
            return;
        }

        if (!plan || plan.parts.length === 0) {
            setLocalError('No valid processing plan available.');
            return;
        }

        if (!effectiveReleaseId) {
            if (onSubmit) {
                const firstPart = plan.parts[0];
                const metaInput: CreateReleaseFileInput = {
                    path: firstPart.path,
                    logical_path: firstPart.logical_path,
                    operation: firstPart.operation,
                    size: firstPart.size,
                    sha256: firstPart.sha256,
                    part_index: firstPart.part_index,
                    part_count: firstPart.part_count,
                    final_sha256: firstPart.final_sha256
                };
                await onSubmit(metaInput);
                return;
            }
            setLocalError('Missing release ID for asset processing.');
            return;
        }

        setIsProcessing(true);
        const totalParts = plan.parts.length;
        setTotalPartsNum(totalParts);

        const createdIds: string[] = [];

        // 1. METADATA REGISTRATION PHASE
        setProcessStage('registering');
        for (let i = 0; i < totalParts; i++) {
            const part = plan.parts[i];
            setCurrentPartNum(i + 1);
            setCurrentPartPath(part.path);

            const metaInput: CreateReleaseFileInput = {
                path: part.path,
                logical_path: part.logical_path,
                operation: part.operation,
                size: part.size,
                sha256: part.sha256,
                part_index: part.part_index,
                part_count: part.part_count,
                final_sha256: part.final_sha256
            };

            try {
                const res = await ReleaseFilesApi.createReleaseFile(effectiveReleaseId, metaInput);
                createdIds.push(res.id);
            } catch (err: unknown) {
                // Metadata creation failed -> Rollback created entries
                let rollbackFailedCount = 0;
                for (const fileId of createdIds) {
                    try {
                        await ReleaseFilesApi.deleteReleaseFile(effectiveReleaseId, fileId);
                    } catch {
                        rollbackFailedCount++;
                    }
                }

                let rollbackDetail = '';
                if (createdIds.length > 0) {
                    if (rollbackFailedCount === 0) {
                        rollbackDetail = ` Successfully rolled back ${createdIds.length} created entries.`;
                    } else {
                        rollbackDetail = ` Rollback partial: failed to delete ${rollbackFailedCount} entries.`;
                    }
                }

                setLocalError(`Metadata registration failed on part ${i + 1}/${totalParts} (${part.path}): ${formatApiErrorMessage(err)}.${rollbackDetail}`);
                setIsProcessing(false);
                setProcessStage('idle');
                return;
            }
        }

        // 2. PHYSICAL UPLOADS PHASE
        let anyUnverified = false;

        for (let i = 0; i < totalParts; i++) {
            const part = plan.parts[i];
            const fileId = createdIds[i];
            setCurrentPartNum(i + 1);
            setCurrentPartPath(part.path);
            setProcessStage('uploading');
            setUploadPercent(0);

            try {
                const uploadRes = await ReleaseFilesApi.uploadPhysicalAsset(
                    effectiveReleaseId,
                    fileId,
                    part.blob,
                    (progress) => {
                        setUploadPercent(progress.percent);
                        if (progress.percent === 100) {
                            setProcessStage('verifying');
                        }
                    }
                );

                if (uploadRes.verified === false) {
                    anyUnverified = true;
                }
            } catch (err: unknown) {
                // Upload failed -> Do NOT delete metadata; preserve for manual retry
                setLocalError(`Upload failed on part ${i + 1}/${totalParts} (${part.path}): ${formatApiErrorMessage(err)}. Metadata was preserved so you can retry upload from the files table.`);
                setIsProcessing(false);
                setProcessStage('idle');
                await onSuccess?.();
                return;
            }
        }

        // 3. SUCCESSFUL COMPLETION
        setIsProcessing(false);
        setProcessStage('idle');

        if (anyUnverified) {
            setSuccessNotice('Upload completed — verification pending');
        } else {
            setSuccessNotice(`✓ All ${totalParts} parts registered, uploaded, and verified successfully!`);
        }

        // Reset creation form
        setSelectedFile(null);
        setPlan(null);
        setPath('');
        setLogicalPath('');
        setOperation('add');

        await onSuccess?.();
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]} (${bytes.toLocaleString()} bytes)`;
    };

    // ==========================================
    // RENDER EDIT MODE
    // ==========================================
    if (isEdit) {
        return (
            <form onSubmit={handleEditSubmit} className="form-card" aria-label="Edit Release File Form">
                <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
                    <h3 className="card-title">Edit Release File: {initialData?.filename || initialData?.path}</h3>
                    {onCancel && (
                        <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn btn-secondary btn-sm">
                            Cancel
                        </button>
                    )}
                </div>

                {localError && (
                    <div role="alert" className="alert alert-danger">
                        {localError}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="edit-file-path" className="form-label">Path (e.g. mods/optifine.jar):</label>
                    <input
                        id="edit-file-path"
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        aria-label="Path"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="edit-file-logical-path" className="form-label">Logical Path (e.g. mods/optifine.jar):</label>
                    <input
                        id="edit-file-logical-path"
                        type="text"
                        value={logicalPath}
                        onChange={(e) => setLogicalPath(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        aria-label="Logical Path"
                        required
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label htmlFor="edit-file-operation" className="form-label">Operation:</label>
                        <select
                            id="edit-file-operation"
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
                        <label htmlFor="edit-file-size" className="form-label">Size (bytes):</label>
                        <input
                            id="edit-file-size"
                            type="number"
                            min="0"
                            value={editSize}
                            onChange={(e) => setEditSize(e.target.value)}
                            disabled={isSubmitting}
                            className="form-control"
                            aria-label="Size (bytes)"
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="edit-file-sha256" className="form-label">SHA-256 (64 hex characters):</label>
                    <input
                        id="edit-file-sha256"
                        type="text"
                        value={editSha256}
                        onChange={(e) => setEditSha256(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        style={{ fontFamily: 'monospace' }}
                        aria-label="SHA-256"
                        placeholder={operation === 'delete' ? 'Optional for delete' : 'Required for add/replace'}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label htmlFor="edit-file-part-index" className="form-label">Part Index (optional):</label>
                        <input
                            id="edit-file-part-index"
                            type="number"
                            min="1"
                            value={editPartIndex}
                            onChange={(e) => setEditPartIndex(e.target.value)}
                            disabled={isSubmitting}
                            className="form-control"
                            aria-label="Part Index"
                            placeholder="e.g. 1"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-file-part-count" className="form-label">Part Count (optional):</label>
                        <input
                            id="edit-file-part-count"
                            type="number"
                            min="1"
                            value={editPartCount}
                            onChange={(e) => setEditPartCount(e.target.value)}
                            disabled={isSubmitting}
                            className="form-control"
                            aria-label="Part Count"
                            placeholder="e.g. 2"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="edit-file-final-sha256" className="form-label">Final SHA-256 (for multipart, optional):</label>
                    <input
                        id="edit-file-final-sha256"
                        type="text"
                        value={editFinalSha256}
                        onChange={(e) => setEditFinalSha256(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        style={{ fontFamily: 'monospace' }}
                        aria-label="Final SHA-256"
                        placeholder="SHA-256 of the assembled complete file"
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                        {isSubmitting ? 'Saving...' : (submitLabel || 'Save Changes')}
                    </button>
                    {onCancel && (
                        <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn btn-secondary">
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        );
    }

    // ==========================================
    // RENDER CREATE MODE (AUTOMATIC WORKSPACE)
    // ==========================================
    const isBusy = isProcessing || isSubmitting || isAnalyzing;

    return (
        <form onSubmit={handleCreateSubmit} className="form-card" aria-label="Add Release File Form">
            <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
                <h3 className="card-title">Add Release File</h3>
            </div>

            {localError && (
                <div role="alert" className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                    {localError}
                </div>
            )}

            {successNotice && (
                <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                    {successNotice}
                </div>
            )}

            {/* Operation Selector */}
            <div className="form-group">
                <label htmlFor="file-operation" className="form-label">Operation:</label>
                <select
                    id="file-operation"
                    value={operation}
                    onChange={(e) => handleOperationChange(e.target.value as ReleaseFileOperation)}
                    disabled={isBusy}
                    className="form-control"
                    aria-label="Operation"
                >
                    <option value="add">add (New file asset)</option>
                    <option value="replace">replace (Overwrite existing asset)</option>
                    <option value="delete">delete (Remove asset from client)</option>
                </select>
            </div>

            {/* File Selector (Hidden for delete) */}
            {operation !== 'delete' && (
                <div className="file-inspector-card" data-testid="file-inspector-card">
                    <label htmlFor="local-file-inspect" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>Release File:</strong>
                    </label>
                    <input
                        id="local-file-inspect"
                        type="file"
                        onChange={handleFileChange}
                        disabled={isBusy}
                        aria-label="Inspect local file"
                        className="form-control"
                        data-testid="local-file-inspect"
                    />
                    <p className="form-help-text">Supports .jar, .zip and other release assets.</p>

                    {selectedFile && (
                        <div data-testid="selected-file-info" style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Selected: <strong style={{ color: 'var(--text-primary)' }}>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})
                        </div>
                    )}

                    {isAnalyzing && (
                        <div data-testid="analysis-progress" style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                            Analyzing file SHA-256: {analysisProgress}%
                        </div>
                    )}
                </div>
            )}

            {/* Path and Logical Path Inputs */}
            <div className="form-group">
                <label htmlFor="file-path" className="form-label">Path (e.g. mods/optifine.jar):</label>
                <input
                    id="file-path"
                    type="text"
                    value={path}
                    onChange={(e) => handlePathChange(e.target.value)}
                    disabled={isBusy}
                    className="form-control"
                    aria-label="Path"
                    placeholder="mods/optifine.jar"
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="file-logical-path" className="form-label">Logical Path (e.g. mods/optifine.jar):</label>
                <input
                    id="file-logical-path"
                    type="text"
                    value={logicalPath}
                    onChange={(e) => handleLogicalPathChange(e.target.value)}
                    disabled={isBusy}
                    className="form-control"
                    aria-label="Logical Path"
                    placeholder="mods/optifine.jar"
                    required
                />
            </div>

            {/* Automatic Processing Plan Summary */}
            {plan && operation !== 'delete' && (
                <div className="card" data-testid="asset-plan-summary" style={{ backgroundColor: 'var(--bg-surface-elevated)', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Automatic Processing Plan</h4>
                        <span
                            className={plan.isMultipart ? 'badge badge-beta' : 'badge badge-stable'}
                            data-testid="plan-type-badge"
                        >
                            {plan.isMultipart ? `Multipart: ${plan.partCount} parts (up to 1 GiB)` : 'Single Asset (1 part)'}
                        </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }} data-testid="plan-final-sha256-container">
                        <span style={{ color: 'var(--text-secondary)' }}>Final File SHA-256: </span>
                        <code data-testid="plan-final-sha256" style={{ wordBreak: 'break-all', display: 'inline-block', marginTop: '0.25rem' }}>
                            {plan.finalSha256}
                        </code>
                    </div>

                    {plan.isMultipart && (
                        <div className="table-container" style={{ marginTop: '0.75rem' }}>
                            <table className="data-table" data-testid="multipart-parts-table" style={{ fontSize: '0.8rem' }}>
                                <thead>
                                    <tr>
                                        <th>Part</th>
                                        <th>Physical Path</th>
                                        <th>Size</th>
                                        <th>Part SHA-256</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plan.parts.map((p) => (
                                        <tr key={p.path}>
                                            <td style={{ fontWeight: 600 }}>{p.part_index} / {p.part_count}</td>
                                            <td><code>{p.path}</code></td>
                                            <td>{p.size.toLocaleString()} B</td>
                                            <td style={{ fontFamily: 'monospace' }}>{p.sha256.substring(0, 16)}...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Processing Progress Status Display */}
            {isProcessing && (
                <div className="alert alert-info" data-testid="processing-status" style={{ marginBottom: '1.25rem' }}>
                    <strong>Processing Release Asset...</strong>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                        {processStage === 'registering' && (
                            <span>Registering part {currentPartNum}/{totalPartsNum} (<code>{currentPartPath}</code>)...</span>
                        )}
                        {processStage === 'uploading' && (
                            <span>Uploading part {currentPartNum}/{totalPartsNum} (<code>{currentPartPath}</code>): {uploadPercent}%</span>
                        )}
                        {processStage === 'verifying' && (
                            <span>Verifying part {currentPartNum}/{totalPartsNum} with GitHub...</span>
                        )}
                    </div>
                </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
                <button
                    type="submit"
                    disabled={isBusy || (operation !== 'delete' && (!selectedFile || !plan))}
                    className="btn btn-primary"
                    data-testid="submit-asset-btn"
                >
                    {isProcessing
                        ? (processStage === 'registering'
                            ? `Registering part ${currentPartNum}/${totalPartsNum}...`
                            : processStage === 'verifying'
                                ? `Verifying part ${currentPartNum}/${totalPartsNum}...`
                                : `Uploading part ${currentPartNum}/${totalPartsNum}: ${uploadPercent}%`)
                        : (submitLabel || (operation === 'delete' ? 'Add File' : 'Process & Upload File'))}
                </button>
            </div>
        </form>
    );
};
