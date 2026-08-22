import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Release, UpdateReleaseInput, GitHubReleaseStatusResponse, GitHubReleasePrepareResponse } from '../types/releases';
import type { CreateReleaseFileInput, UpdateReleaseFileInput, ReleaseFile } from '../types/releaseFiles';
import type { ReleaseValidationResponse } from '../types/validation';
import { formatApiErrorMessage } from '../api/client';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { ReleaseForm } from '../components/ReleaseForm';
import { ReleaseFilesTable } from '../components/ReleaseFilesTable';
import { ReleaseFileForm } from '../components/ReleaseFileForm';
import { ErrorBoundary } from '../components/ErrorBoundary';

export const ReleaseDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [release, setRelease] = useState<Release | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isEditingRelease, setIsEditingRelease] = useState(false);

    // Release Files state
    const [files, setFiles] = useState<ReleaseFile[]>([]);
    const [isFilesLoading, setIsFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState<string | null>(null);
    const [fileActionError, setFileActionError] = useState<string | null>(null);
    const [isAddingFile, setIsAddingFile] = useState(false);
    const [editingFile, setEditingFile] = useState<ReleaseFile | null>(null);
    const [isUpdatingFile, setIsUpdatingFile] = useState(false);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

    // Validation / Readiness state
    const [validation, setValidation] = useState<ReleaseValidationResponse | null>(null);
    const [isValidationLoading, setIsValidationLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // GitHub Assets state
    const [githubStatus, setGithubStatus] = useState<GitHubReleaseStatusResponse | null>(null);
    const [isGithubLoading, setIsGithubLoading] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);
    const [prepareResult, setPrepareResult] = useState<GitHubReleasePrepareResponse | null>(null);

    // Publish state
    const [confirmVersionInput, setConfirmVersionInput] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [publishSuccess, setPublishSuccess] = useState(false);

    const fetchValidation = useCallback(() => {
        if (!id) return;
        setIsValidationLoading(true);
        setValidationError(null);
        ReleasesApi.validateRelease(id)
            .then((res) => {
                setValidation(res);
                setValidationError(null);
            })
            .catch((err: unknown) => {
                setValidationError(formatApiErrorMessage(err));
            })
            .finally(() => setIsValidationLoading(false));
    }, [id]);

    const fetchFiles = useCallback(() => {
        if (!id) return;
        setIsFilesLoading(true);
        setFilesError(null);
        ReleaseFilesApi.listReleaseFiles(id)
            .then((res) => {
                setFiles(res?.value || []);
                setFilesError(null);
            })
            .catch((err: unknown) => {
                setFilesError(formatApiErrorMessage(err));
            })
            .finally(() => setIsFilesLoading(false));
    }, [id]);

    const fetchRelease = useCallback(() => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        ReleasesApi.getRelease(id)
            .then((res) => {
                setRelease(res);
                setError(null);
                fetchFiles();
                fetchValidation();
            })
            .catch((err: unknown) => {
                const msg = formatApiErrorMessage(err);
                setError(msg);
            })
            .finally(() => setIsLoading(false));
    }, [id, fetchFiles, fetchValidation]);

    useEffect(() => {
        fetchRelease();
    }, [fetchRelease]);

    const handleDeleteRelease = async () => {
        if (!id || !release || release.status !== 'draft') return;
        if (!window.confirm('Are you sure you want to delete this draft release?')) return;
        setActionError(null);
        try {
            await ReleasesApi.deleteRelease(id);
            navigate('/releases');
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setActionError(msg);
        }
    };

    const handleUpdateRelease = async (data: UpdateReleaseInput) => {
        if (!id) return;
        setActionError(null);
        try {
            await ReleasesApi.updateRelease(id, data);
            setIsEditingRelease(false);
            fetchRelease();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setActionError(msg);
            throw err;
        }
    };

    const handleAddFile = async (data: CreateReleaseFileInput | UpdateReleaseFileInput) => {
        if (!id) return;
        setIsAddingFile(true);
        setFileActionError(null);
        try {
            await ReleaseFilesApi.createReleaseFile(id, data as CreateReleaseFileInput);
            fetchFiles();
            fetchValidation();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setFileActionError(msg);
            throw err;
        } finally {
            setIsAddingFile(false);
        }
    };

    const handleUpdateFile = async (data: CreateReleaseFileInput | UpdateReleaseFileInput) => {
        if (!id || !editingFile?.id) return;
        setIsUpdatingFile(true);
        setFileActionError(null);
        try {
            await ReleaseFilesApi.updateReleaseFile(id, editingFile.id, data as UpdateReleaseFileInput);
            setEditingFile(null);
            fetchFiles();
            fetchValidation();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setFileActionError(msg);
            throw err;
        } finally {
            setIsUpdatingFile(false);
        }
    };

    const handleDeleteFile = async (file: ReleaseFile) => {
        if (!id || !file.id) return;
        setDeletingFileId(file.id);
        setFileActionError(null);
        try {
            await ReleaseFilesApi.deleteReleaseFile(id, file.id);
            if (editingFile?.id === file.id) {
                setEditingFile(null);
            }
            fetchFiles();
            fetchValidation();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setFileActionError(msg);
        } finally {
            setDeletingFileId(null);
        }
    };

    const handlePrepareGitHub = async () => {
        if (!id) return;
        setIsGithubLoading(true);
        setGithubError(null);
        try {
            const res = await ReleasesApi.prepareGitHubRelease(id);
            setPrepareResult(res);
            handleCheckGitHubStatus();
        } catch (err: unknown) {
            setGithubError(formatApiErrorMessage(err));
        } finally {
            setIsGithubLoading(false);
        }
    };

    const handleCheckGitHubStatus = async () => {
        if (!id) return;
        setIsGithubLoading(true);
        setGithubError(null);
        try {
            const res = await ReleasesApi.getGitHubReleaseStatus(id);
            setGithubStatus(res);
        } catch (err: unknown) {
            setGithubError(formatApiErrorMessage(err));
        } finally {
            setIsGithubLoading(false);
        }
    };

    const handlePublishRelease = async () => {
        if (!id || !release) return;
        if (confirmVersionInput !== release.version) {
            setPublishError(`Version confirmation does not match "${release.version}".`);
            return;
        }
        setIsPublishing(true);
        setPublishError(null);
        try {
            await ReleasesApi.publishRelease(id, confirmVersionInput);
            setPublishSuccess(true);
            fetchRelease();
        } catch (err: unknown) {
            setPublishError(formatApiErrorMessage(err));
        } finally {
            setIsPublishing(false);
        }
    };

    if (isLoading) return <div className="state-loading">Loading release...</div>;
    if (error) return <div role="alert" className="alert alert-danger">{error}</div>;
    if (!release) return <div className="state-empty">Release not found.</div>;

    if (isEditingRelease && release.status === 'draft') {
        return (
            <div>
                <div className="page-header">
                    <h1>Edit Release {release.version}</h1>
                    <button onClick={() => { setIsEditingRelease(false); setActionError(null); }} className="btn btn-secondary">
                        Cancel
                    </button>
                </div>
                <div style={{ marginTop: '1rem' }}>
                    <ReleaseForm
                        initialData={release}
                        onSubmit={handleUpdateRelease}
                        submitLabel="Save Changes"
                        error={actionError}
                    />
                </div>
            </div>
        );
    }

    const notes = release.release_notes || 'None';
    const totalSizeText = (release.total_size !== undefined && release.total_size !== null)
        ? `${release.total_size.toLocaleString()} bytes`
        : 'Not specified';

    const isDraft = release.status === 'draft';

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published': return 'badge badge-published';
            case 'draft': return 'badge badge-draft';
            case 'deprecated': return 'badge badge-deprecated';
            default: return 'badge';
        }
    };

    return (
        <div className="release-detail-container">
            {/* 1. Cabecera de la release */}
            <div className="page-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h1>Release Details: {release.version}</h1>
                        <span className={getStatusBadge(release.status)}>{release.status}</span>
                        <span className={release.channel === 'stable' ? 'badge badge-stable' : 'badge badge-beta'}>{release.channel}</span>
                        <span className={release.release_type === 'launcher' ? 'badge badge-launcher' : 'badge badge-modpack'}>{release.release_type}</span>
                    </div>
                </div>
                <div className="actions-group">
                    {isDraft && (
                        <button onClick={() => { setIsEditingRelease(true); setActionError(null); }} className="btn btn-secondary">
                            Edit
                        </button>
                    )}
                    {isDraft && (
                        <button onClick={handleDeleteRelease} className="btn btn-danger">
                            Delete Draft
                        </button>
                    )}
                </div>
            </div>

            {actionError && (
                <div role="alert" className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
                    {actionError}
                </div>
            )}

            {/* 2. Metadata */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="card-header">
                    <span className="card-title">Release Metadata</span>
                </div>
                <div className="info-grid">
                    <div className="info-item">
                        <div className="info-item-label">Version</div>
                        <div className="info-item-value">{release.version}</div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Type</div>
                        <div className="info-item-value" style={{ textTransform: 'capitalize' }}>{release.release_type}</div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Channel</div>
                        <div className="info-item-value" style={{ textTransform: 'capitalize' }}>{release.channel}</div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Status</div>
                        <div className="info-item-value" style={{ textTransform: 'capitalize' }}>{release.status}</div>
                    </div>
                    <div className="info-item">
                        <div className="info-item-label">Total Size</div>
                        <div className="info-item-value">{totalSizeText}</div>
                    </div>
                </div>
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <div className="info-item-label">Release Notes</div>
                    <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{notes}</p>
                </div>
            </div>

            {/* 3. Archivos actuales */}
            <section aria-labelledby="release-files-heading" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 id="release-files-heading">Release Files</h2>
                </div>

                {fileActionError && (
                    <div role="alert" className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                        {fileActionError}
                    </div>
                )}

                <ErrorBoundary fallbackTitle="Release Files Section Error">
                    <ReleaseFilesTable
                        releaseId={id}
                        files={files}
                        isLoading={isFilesLoading}
                        error={filesError}
                        isDraft={isDraft}
                        deletingFileId={deletingFileId}
                        onEdit={(file) => {
                            setEditingFile(file);
                            setFileActionError(null);
                        }}
                        onDelete={handleDeleteFile}
                        onAssetUploaded={handleCheckGitHubStatus}
                    />

                    {/* 4. Formulario Add/Replace/Delete & 5. Estado de análisis y upload */}
                    {isDraft && (
                        <div style={{ marginTop: '1.5rem' }}>
                            {editingFile ? (
                                <ReleaseFileForm
                                    releaseId={id}
                                    initialData={editingFile}
                                    onSubmit={handleUpdateFile}
                                    onCancel={() => {
                                        setEditingFile(null);
                                        setFileActionError(null);
                                    }}
                                    onSuccess={async () => {
                                        await fetchFiles();
                                        await fetchValidation();
                                    }}
                                    isSubmitting={isUpdatingFile}
                                    submitLabel="Save Changes"
                                />
                            ) : (
                                <ReleaseFileForm
                                    releaseId={id}
                                    onSubmit={handleAddFile}
                                    onSuccess={async () => {
                                        await fetchFiles();
                                        await fetchValidation();
                                    }}
                                    isSubmitting={isAddingFile}
                                    submitLabel="Add File"
                                />
                            )}
                        </div>
                    )}
                </ErrorBoundary>
            </section>

            {/* 6. Release Readiness & Validation */}
            <section aria-labelledby="release-readiness-heading" className="card" style={{ marginBottom: '2rem' }}>
                <div className="card-header">
                    <h2 id="release-readiness-heading" className="card-title">Release Readiness & Validation</h2>
                    <button type="button" onClick={fetchValidation} disabled={isValidationLoading} className="btn btn-secondary btn-sm">
                        Re-validate
                    </button>
                </div>
                {isValidationLoading && <div data-testid="validation-loading" className="state-loading">Loading validation status...</div>}
                {validationError && (
                    <div role="alert" className="alert alert-danger">
                        {validationError}
                    </div>
                )}
                {!isValidationLoading && !validationError && validation && (
                    <div>
                        {validation.valid ? (
                            <div className="alert alert-success" style={{ fontWeight: 600 }}>
                                ✓ Release is valid and ready for publishing.
                            </div>
                        ) : (
                            <div className="alert alert-danger">
                                <strong>⚠️ Release has validation issues:</strong>
                                <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                                    {validation.issues.map((issue, idx) => (
                                        <li key={idx}>
                                            <code>{issue.code}</code>
                                            {issue.path && <span> (path: <code>{issue.path}</code>)</span>}
                                            {issue.message && <span>: {issue.message}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* 7. GitHub Release & Assets Status */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="card-header">
                    <span className="card-title">GitHub Release & Assets Status</span>
                    <div className="actions-group">
                        {isDraft && (
                            <button
                                type="button"
                                onClick={handlePrepareGitHub}
                                disabled={isGithubLoading}
                                className="btn btn-primary btn-sm"
                            >
                                Prepare GitHub Draft
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleCheckGitHubStatus}
                            disabled={isGithubLoading}
                            className="btn btn-secondary btn-sm"
                        >
                            Check Status
                        </button>
                    </div>
                </div>

                {isGithubLoading && <div className="state-loading">Checking GitHub release status...</div>}
                {githubError && <div role="alert" className="alert alert-danger">{githubError}</div>}

                {prepareResult && (
                    <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                        Draft release prepared on GitHub! Tag: <code>{prepareResult.github_tag}</code> (ID: {prepareResult.github_release_id})
                    </div>
                )}

                {githubStatus && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <strong>Synchronization State:</strong>
                            <span className={githubStatus.status === 'ready' ? 'badge badge-ready' : 'badge badge-draft'}>
                                {githubStatus.status}
                            </span>
                        </div>

                        <h4>Asset Status Mapping:</h4>
                        <div className="table-container" style={{ marginTop: '0.5rem' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>File Path</th>
                                        <th>Asset Status</th>
                                        <th>GitHub Asset ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {files.map((f) => {
                                        const stat = githubStatus.assetStatuses[f.id];
                                        return (
                                            <tr key={f.id}>
                                                <td>{f.path}</td>
                                                <td>
                                                    <span className={stat?.status === 'ready' ? 'badge badge-ready' : 'badge badge-not-ready'}>
                                                        {stat?.status || 'unknown'}
                                                    </span>
                                                </td>
                                                <td>{stat?.github_asset_id ? `#${stat.github_asset_id}` : '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {githubStatus.unexpectedAssets.length > 0 && (
                            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                                <strong>Unexpected Assets found on GitHub:</strong>
                                <ul>
                                    {githubStatus.unexpectedAssets.map((u) => (
                                        <li key={u.id}>{u.name} (ID: {u.id})</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 8. Panel Publish */}
            <div className="card" style={{ maxWidth: '700px', marginBottom: '2rem' }}>
                <div className="card-header">
                    <span className="card-title">Publish Release</span>
                </div>

                {/* 9. Resultado o mensajes de publicación */}
                {publishSuccess && (
                    <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                        ✓ Release published successfully!
                    </div>
                )}

                {publishError && (
                    <div role="alert" className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                        {publishError}
                    </div>
                )}

                {release.status === 'published' ? (
                    <div className="alert alert-info">
                        This release is already published.
                    </div>
                ) : (
                    <div>
                        <p style={{ marginBottom: '1rem' }}>
                            Publishing this release will freeze all file metadata, generate and upload the canonical <code>launcherxd-manifest.json</code>, publish the GitHub draft release, and mark the release as <strong>published</strong> for all clients.
                        </p>

                        <div className="form-group">
                            <label className="form-label">
                                To confirm, type the version <code>{release.version}</code> below:
                            </label>
                            <input
                                type="text"
                                value={confirmVersionInput}
                                onChange={(e) => setConfirmVersionInput(e.target.value)}
                                placeholder={release.version}
                                className="form-control"
                                disabled={isPublishing}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handlePublishRelease}
                            disabled={isPublishing || confirmVersionInput !== release.version}
                            className="btn btn-success"
                        >
                            {isPublishing ? 'Publishing...' : 'Publish Release'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
