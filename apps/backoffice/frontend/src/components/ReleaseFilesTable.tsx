import React, { useState } from 'react';
import type { ReleaseFile, UploadProgress } from '../types/releaseFiles';
import { partitionReleaseFiles } from '../api/multipart';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { formatApiErrorMessage } from '../api/client';

interface FileUploadState {
    status: 'idle' | 'uploading' | 'verifying' | 'ready' | 'error';
    percent: number;
    loaded: number;
    total: number;
    error: string | null;
}

interface Props {
    releaseId?: string;
    files: ReleaseFile[];
    isLoading: boolean;
    error: string | null;
    isDraft?: boolean;
    deletingFileId?: string | null;
    onEdit?: (file: ReleaseFile) => void;
    onDelete?: (file: ReleaseFile) => Promise<void>;
    onAssetUploaded?: () => void;
}

export const ReleaseFilesTable: React.FC<Props> = ({
    releaseId,
    files,
    isLoading,
    error,
    isDraft = false,
    deletingFileId = null,
    onEdit,
    onDelete,
    onAssetUploaded
}) => {
    const [uploadStates, setUploadStates] = useState<Record<string, FileUploadState>>({});

    if (isLoading) return <div data-testid="release-files-loading" className="state-loading">Loading release files...</div>;
    if (error) return <div role="alert" className="alert alert-danger">{error}</div>;
    if (files.length === 0) return <div className="state-empty">No release files found.</div>;

    const { standalone, multipartGroups } = partitionReleaseFiles(files);

    const handleDeleteClick = (file: ReleaseFile) => {
        if (!onDelete) return;
        const confirmMsg = `Are you sure you want to delete file "${file.path}"?`;
        if (!window.confirm(confirmMsg)) return;
        onDelete(file);
    };

    const handleFileSelected = async (file: ReleaseFile, selectedFile?: File) => {
        if (!selectedFile || !releaseId) return;

        setUploadStates((prev) => ({
            ...prev,
            [file.id]: {
                status: 'uploading',
                percent: 0,
                loaded: 0,
                total: selectedFile.size,
                error: null
            }
        }));

        try {
            await ReleaseFilesApi.uploadPhysicalAsset(
                releaseId,
                file.id,
                selectedFile,
                (progress: UploadProgress) => {
                    setUploadStates((prev) => ({
                        ...prev,
                        [file.id]: {
                            status: progress.percent >= 100 ? 'verifying' : 'uploading',
                            percent: progress.percent,
                            loaded: progress.loaded,
                            total: progress.total,
                            error: null
                        }
                    }));
                }
            );

            setUploadStates((prev) => ({
                ...prev,
                [file.id]: {
                    status: 'ready',
                    percent: 100,
                    loaded: selectedFile.size,
                    total: selectedFile.size,
                    error: null
                }
            }));

            onAssetUploaded?.();
        } catch (err: unknown) {
            const errorMsg = formatApiErrorMessage(err, 'file');
            setUploadStates((prev) => ({
                ...prev,
                [file.id]: {
                    status: 'error',
                    percent: 0,
                    loaded: 0,
                    total: selectedFile.size,
                    error: errorMsg
                }
            }));
        }
    };

    const renderUploadControl = (file: ReleaseFile) => {
        if (file.operation === 'delete') {
            return (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No upload required
                </div>
            );
        }

        const state = uploadStates[file.id];
        const isUploading = state?.status === 'uploading' || state?.status === 'verifying';

        return (
            <div style={{ marginTop: '0.25rem' }}>
                <input
                    type="file"
                    id={`upload-input-${file.id}`}
                    aria-label={`Upload file for ${file.filename || file.path}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const sel = e.target.files?.[0];
                        if (sel) handleFileSelected(file, sel);
                        e.target.value = '';
                    }}
                />

                {state?.status === 'ready' ? (
                    <span className="badge badge-ready" data-testid={`upload-ready-${file.id}`}>✓ Upload verified</span>
                ) : isUploading ? (
                    <div>
                        {state?.status === 'verifying' ? (
                            <span className="badge badge-beta" data-testid={`upload-verifying-${file.id}`}>100% — Verifying with GitHub...</span>
                        ) : (
                            <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                                    Uploading: {state?.percent}%
                                </span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {((state?.loaded || 0) / 1024).toFixed(0)} KB / {((state?.total || 0) / 1024).toFixed(0)} KB
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <button
                            type="button"
                            onClick={() => document.getElementById(`upload-input-${file.id}`)?.click()}
                            disabled={!isDraft || !releaseId}
                            className="btn btn-primary btn-sm"
                            aria-label={state?.status === 'error' ? `Retry Upload for ${file.filename || file.path}` : `Upload Asset for ${file.filename || file.path}`}
                            data-testid={`upload-btn-${file.id}`}
                        >
                            {state?.status === 'error' ? 'Retry Upload' : 'Upload Asset'}
                        </button>
                        {state?.status === 'error' && (
                            <div role="alert" className="alert alert-danger" style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                {state.error}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div data-testid="release-files-container" style={{ marginTop: '1rem' }}>
            {standalone.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h3>Standalone Files</h3>
                        <span className="badge badge-public">{standalone.length} files</span>
                    </div>
                    <div className="table-container">
                        <table className="data-table" aria-label="Standalone Files Table">
                            <thead>
                                <tr>
                                    <th>Path</th>
                                    <th>Logical Path</th>
                                    <th>Filename</th>
                                    <th>Operation</th>
                                    <th>Size</th>
                                    <th>SHA-256</th>
                                    <th>Physical Upload</th>
                                    {isDraft && <th className="cell-actions">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {standalone.map((f) => (
                                    <tr key={f.id}>
                                        <td style={{ fontWeight: 600 }}>{f.path}</td>
                                        <td>{f.logical_path}</td>
                                        <td>{f.filename}</td>
                                        <td><span className="badge badge-stable">{f.operation}</span></td>
                                        <td>{f.size.toLocaleString()} B</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                            {f.sha256 || '-'}
                                        </td>
                                        <td>{renderUploadControl(f)}</td>
                                        {isDraft && (
                                            <td className="cell-actions">
                                                <div className="actions-group">
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit?.(f)}
                                                        disabled={deletingFileId === f.id}
                                                        className="btn btn-secondary btn-sm"
                                                        aria-label={`Edit ${f.filename || f.path}`}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClick(f)}
                                                        disabled={deletingFileId === f.id}
                                                        className="btn btn-danger btn-sm"
                                                        aria-label={`Delete ${f.filename || f.path}`}
                                                    >
                                                        {deletingFileId === f.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {multipartGroups.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h3>Multipart File Groups</h3>
                        <span className="badge badge-beta">{multipartGroups.length} groups</span>
                    </div>
                    {multipartGroups.map((group) => {
                        const allPartsReady = group.parts.length > 0 && group.parts.every((p) => uploadStates[p.id]?.status === 'ready');

                        return (
                            <div
                                key={group.logical_path}
                                className="card"
                                data-testid={`multipart-group-${group.logical_path}`}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div>
                                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Logical Path: {group.logical_path}</strong>
                                        <span style={{ marginLeft: '1rem' }} className={group.is_complete ? 'badge badge-ready' : 'badge badge-not-ready'}>
                                            {group.is_complete ? '✓ Complete' : '⚠️ Incomplete'}
                                        </span>
                                        {allPartsReady && (
                                            <span style={{ marginLeft: '0.5rem' }} className="badge badge-ready">
                                                ✓ Multipart assets ready
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        <span>Parts: {group.parts.length} / {group.expected_part_count ?? '?'}</span>
                                    </div>
                                </div>

                                {group.final_sha256 && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
                                        <strong>Final SHA-256:</strong> <code style={{ fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{group.final_sha256}</code>
                                    </div>
                                )}

                                {group.diagnostics.length > 0 && (
                                    <div role="status" className="alert alert-warning" style={{ margin: '0.5rem 0 1rem 0' }}>
                                        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Multipart Diagnostics:</strong>
                                        <ul style={{ margin: '0 0 0 1.25rem', padding: 0 }}>
                                            {group.diagnostics.map((diag, idx) => (
                                                <li key={idx}>{diag}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="table-container" style={{ margin: 0 }}>
                                    <table className="data-table" aria-label={`Multipart Parts for ${group.logical_path}`}>
                                        <thead>
                                            <tr>
                                                <th>Part</th>
                                                <th>Path</th>
                                                <th>Filename</th>
                                                <th>Operation</th>
                                                <th>Size</th>
                                                <th>Part SHA-256</th>
                                                <th>Physical Upload</th>
                                                {isDraft && <th className="cell-actions">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.parts.map((part) => (
                                                <tr key={part.id || part.path}>
                                                    <td style={{ fontWeight: 600 }}>Part {part.part_index}/{part.part_count}</td>
                                                    <td>{part.path}</td>
                                                    <td>{part.filename || part.path.split('/').pop()}</td>
                                                    <td><span className="badge badge-stable">{part.operation}</span></td>
                                                    <td>{part.size.toLocaleString()} B</td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                                        {part.sha256 || '-'}
                                                    </td>
                                                    <td>{renderUploadControl(part)}</td>
                                                    {isDraft && (
                                                        <td className="cell-actions">
                                                            <div className="actions-group">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onEdit?.(part)}
                                                                    disabled={deletingFileId === part.id}
                                                                    className="btn btn-secondary btn-sm"
                                                                    aria-label={`Edit ${part.filename || part.path}`}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteClick(part)}
                                                                    disabled={deletingFileId === part.id}
                                                                    className="btn btn-danger btn-sm"
                                                                    aria-label={`Delete ${part.filename || part.path}`}
                                                                >
                                                                    {deletingFileId === part.id ? 'Deleting...' : 'Delete'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
