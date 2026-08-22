import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { formatApiErrorMessage, ApiClientError } from '../api/client';
import { PageHeader } from '../components/ui/PageHeader';
import { ReleaseFilesTable } from '../components/ReleaseFilesTable';
import { ReleaseFileForm } from '../components/ReleaseFileForm';
import type {
    Release,
    CreateReleaseInput,
    ReleaseChannel,
    GitHubReleasePrepareResponse,
    GitHubReleaseStatusResponse,
    DeletionSteps
} from '../types/releases';
import type { ReleaseFile, CreateReleaseFileInput, UpdateReleaseFileInput } from '../types/releaseFiles';
import type { ReleaseValidationResponse } from '../types/validation';

const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const ModpackPage: React.FC = () => {
    // List & Draft Creation State
    const [releases, setReleases] = useState<Release[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [version, setVersion] = useState<string>('');
    const [channel, setChannel] = useState<ReleaseChannel>('stable');
    const [releaseNotes, setReleaseNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Selected Release & Workspace State
    const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
    const activeReleaseIdRef = useRef<string | null>(null);

    // Workspace Files State
    const [files, setFiles] = useState<ReleaseFile[]>([]);
    const [isFilesLoading, setIsFilesLoading] = useState<boolean>(false);
    const [filesError, setFilesError] = useState<string | null>(null);
    const [fileActionError, setFileActionError] = useState<string | null>(null);
    const [editingFile, setEditingFile] = useState<ReleaseFile | null>(null);
    const [isAddingFile, setIsAddingFile] = useState<boolean>(false);
    const [isUpdatingFile, setIsUpdatingFile] = useState<boolean>(false);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

    // Workspace Validation State
    const [validation, setValidation] = useState<ReleaseValidationResponse | null>(null);
    const [isValidationLoading, setIsValidationLoading] = useState<boolean>(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // GitHub & Publish State (Module 3B-2 Separate States)
    const [isPreparingGitHub, setIsPreparingGitHub] = useState<boolean>(false);
    const [isCheckingGitHub, setIsCheckingGitHub] = useState<boolean>(false);
    const [prepareError, setPrepareError] = useState<string | null>(null);
    const [githubStatusError, setGithubStatusError] = useState<string | null>(null);
    const [prepareResult, setPrepareResult] = useState<GitHubReleasePrepareResponse | null>(null);
    const [githubStatus, setGithubStatus] = useState<GitHubReleaseStatusResponse | null>(null);

    const prepareResultRef = useRef<GitHubReleasePrepareResponse | null>(null);
    prepareResultRef.current = prepareResult;
    const githubStatusRef = useRef<GitHubReleaseStatusResponse | null>(null);
    githubStatusRef.current = githubStatus;

    const [confirmVersionInput, setConfirmVersionInput] = useState<string>('');
    const [isPublishing, setIsPublishing] = useState<boolean>(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [publishSuccessMessage, setPublishSuccessMessage] = useState<string | null>(null);

    // Danger Zone / Delete Everywhere State (Phase 7E, 7F, 7 Final)
    const [confirmDeleteInput, setConfirmDeleteInput] = useState<string>('');
    const [confirmDeletePhraseInput, setConfirmDeletePhraseInput] = useState<string>('');
    const [isDeletingDraft, setIsDeletingDraft] = useState<boolean>(false);
    const [deleteDraftError, setDeleteDraftError] = useState<string | null>(null);
    const [partialDeletionInfo, setPartialDeletionInfo] = useState<{ message: string; steps: DeletionSteps; resolution?: string } | null>(null);

    const isFileMutationPending = isAddingFile || isUpdatingFile || deletingFileId !== null;
    const isMutating = isFileMutationPending || isPreparingGitHub || isCheckingGitHub || isPublishing || isDeletingDraft;

    const fetchModpacks = useCallback(async () => {
        try {
            const res = await ReleasesApi.listReleases();
            setReleases(res.value || []);
            setFetchError(null);
            return res;
        } catch (err: unknown) {
            setFetchError(formatApiErrorMessage(err));
            setReleases(null);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModpacks();
    }, [fetchModpacks]);

    const fetchWorkspaceFiles = useCallback(async (releaseId: string) => {
        setIsFilesLoading(true);
        setFilesError(null);
        try {
            const res = await ReleaseFilesApi.listReleaseFiles(releaseId);
            if (activeReleaseIdRef.current === releaseId) {
                setFiles(res.value || []);
            }
        } catch (err: unknown) {
            if (activeReleaseIdRef.current === releaseId) {
                setFilesError(formatApiErrorMessage(err));
                setFiles([]);
            }
        } finally {
            if (activeReleaseIdRef.current === releaseId) {
                setIsFilesLoading(false);
            }
        }
    }, []);

    const fetchWorkspaceValidation = useCallback(async (releaseId: string) => {
        setIsValidationLoading(true);
        setValidationError(null);
        try {
            const res = await ReleasesApi.validateRelease(releaseId);
            if (activeReleaseIdRef.current === releaseId) {
                setValidation(res);
            }
        } catch (err: unknown) {
            if (activeReleaseIdRef.current === releaseId) {
                setValidationError(formatApiErrorMessage(err));
                setValidation(null);
            }
        } finally {
            if (activeReleaseIdRef.current === releaseId) {
                setIsValidationLoading(false);
            }
        }
    }, []);

    const fetchGitHubStatus = useCallback(async (releaseId: string) => {
        setIsCheckingGitHub(true);
        setGithubStatusError(null);
        try {
            const res = await ReleasesApi.getGitHubReleaseStatus(releaseId);
            if (activeReleaseIdRef.current === releaseId) {
                setGithubStatus(res);
            }
        } catch (err: unknown) {
            if (activeReleaseIdRef.current === releaseId) {
                setGithubStatusError(formatApiErrorMessage(err));
            }
        } finally {
            if (activeReleaseIdRef.current === releaseId) {
                setIsCheckingGitHub(false);
            }
        }
    }, []);

    const handleSelectRelease = useCallback((rel: Release) => {
        if (isMutating) return;
        activeReleaseIdRef.current = rel.id;
        setSelectedRelease(rel);
        setEditingFile(null);
        setFileActionError(null);
        setFilesError(null);
        setValidationError(null);
        setPrepareError(null);
        setGithubStatusError(null);
        setPrepareResult(null);
        setGithubStatus(null);
        setConfirmVersionInput('');
        setConfirmDeleteInput('');
        setConfirmDeletePhraseInput('');
        setDeleteDraftError(null);
        setIsDeletingDraft(false);
        setPublishError(null);
        setPublishSuccessMessage(null);
        setIsPreparingGitHub(false);
        setIsCheckingGitHub(false);
        setIsPublishing(false);
        fetchWorkspaceFiles(rel.id);
        fetchWorkspaceValidation(rel.id);
    }, [isMutating, fetchWorkspaceFiles, fetchWorkspaceValidation]);

    const handleCloseWorkspace = () => {
        if (isMutating) return;
        activeReleaseIdRef.current = null;
        setSelectedRelease(null);
        setEditingFile(null);
        setFileActionError(null);
        setFilesError(null);
        setValidationError(null);
        setPrepareError(null);
        setGithubStatusError(null);
        setPrepareResult(null);
        setGithubStatus(null);
        setConfirmVersionInput('');
        setConfirmDeleteInput('');
        setDeleteDraftError(null);
        setIsDeletingDraft(false);
        setPublishError(null);
        setPublishSuccessMessage(null);
        setFiles([]);
        setValidation(null);
        setIsFilesLoading(false);
        setIsValidationLoading(false);
        setIsAddingFile(false);
        setIsUpdatingFile(false);
        setDeletingFileId(null);
        setIsPreparingGitHub(false);
        setIsCheckingGitHub(false);
        setIsPublishing(false);
    };

    const handleAssetUploaded = useCallback(async () => {
        if (!selectedRelease?.id) return;
        const targetId = selectedRelease.id;
        await fetchWorkspaceFiles(targetId);
        await fetchWorkspaceValidation(targetId);
        if (prepareResultRef.current || githubStatusRef.current) {
            await fetchGitHubStatus(targetId);
        }
    }, [selectedRelease?.id, fetchWorkspaceFiles, fetchWorkspaceValidation, fetchGitHubStatus]);

    const handleCreateDraft = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        setSuccessMessage(null);

        const trimmedVersion = version.trim();
        if (!trimmedVersion) {
            setCreateError('Version is required.');
            return;
        }

        if (!SEMVER_REGEX.test(trimmedVersion)) {
            setCreateError('Invalid version format. Please use valid SemVer (e.g. 1.0.0, 1.0.0-beta.1).');
            return;
        }

        const trimmedNotes = releaseNotes.trim();
        const payload: CreateReleaseInput = {
            version: trimmedVersion,
            channel,
            release_type: 'modpack',
            ...(trimmedNotes ? { release_notes: trimmedNotes } : {})
        };

        setIsSubmitting(true);
        try {
            const res = await ReleasesApi.createRelease(payload);
            setSuccessMessage(`Modpack draft v${trimmedVersion} created successfully.`);
            setVersion('');
            setChannel('stable');
            setReleaseNotes('');

            const listRes = await fetchModpacks();
            const newId = res.id;
            let createdRel = (listRes?.value || []).find((r) => r.id === newId);
            if (!createdRel) {
                createdRel = await ReleasesApi.getRelease(newId);
            }

            handleSelectRelease(createdRel);
        } catch (err: unknown) {
            setCreateError(formatApiErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddFile = async (data: CreateReleaseFileInput | UpdateReleaseFileInput) => {
        if (!selectedRelease?.id) return;
        setIsAddingFile(true);
        setFileActionError(null);
        try {
            await ReleaseFilesApi.createReleaseFile(selectedRelease.id, data as CreateReleaseFileInput);
            await fetchWorkspaceFiles(selectedRelease.id);
            await fetchWorkspaceValidation(selectedRelease.id);
            if (prepareResultRef.current || githubStatusRef.current) {
                await fetchGitHubStatus(selectedRelease.id);
            }
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setFileActionError(msg);
            throw err;
        } finally {
            setIsAddingFile(false);
        }
    };

    const handleUpdateFile = async (data: CreateReleaseFileInput | UpdateReleaseFileInput) => {
        if (!selectedRelease?.id || !editingFile?.id) return;
        setIsUpdatingFile(true);
        setFileActionError(null);
        try {
            await ReleaseFilesApi.updateReleaseFile(selectedRelease.id, editingFile.id, data as UpdateReleaseFileInput);
            setEditingFile(null);
            await fetchWorkspaceFiles(selectedRelease.id);
            await fetchWorkspaceValidation(selectedRelease.id);
            if (prepareResultRef.current || githubStatusRef.current) {
                await fetchGitHubStatus(selectedRelease.id);
            }
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setFileActionError(msg);
            throw err;
        } finally {
            setIsUpdatingFile(false);
        }
    };

    const handleDeleteFile = async (file: ReleaseFile) => {
        if (!selectedRelease?.id || !file.id) return;
        setDeletingFileId(file.id);
        setFileActionError(null);
        try {
            await ReleaseFilesApi.deleteReleaseFile(selectedRelease.id, file.id);
            if (editingFile?.id === file.id) {
                setEditingFile(null);
            }
            await fetchWorkspaceFiles(selectedRelease.id);
            await fetchWorkspaceValidation(selectedRelease.id);
            if (prepareResultRef.current || githubStatusRef.current) {
                await fetchGitHubStatus(selectedRelease.id);
            }
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setFileActionError(msg);
        } finally {
            setDeletingFileId(null);
        }
    };

    // GitHub Handlers (Module 3B-2 Hotfix Guardrails)
    const handlePrepareGitHub = async () => {
        if (!selectedRelease?.id) return;
        const targetReleaseId = selectedRelease.id;

        // Strict guardrail 1: Validation must be completed and valid
        if (isValidationLoading || !validation || !validation.valid) {
            setPrepareError('Cannot prepare GitHub release: validation must pass successfully first.');
            return;
        }
        if (isMutating) return;

        setIsPreparingGitHub(true);
        setPrepareError(null);
        try {
            const res = await ReleasesApi.prepareGitHubRelease(targetReleaseId);
            if (activeReleaseIdRef.current === targetReleaseId) {
                setPrepareResult(res);
            }
            await fetchGitHubStatus(targetReleaseId);
        } catch (err: unknown) {
            if (activeReleaseIdRef.current === targetReleaseId) {
                setPrepareError(formatApiErrorMessage(err));
            }
        } finally {
            if (activeReleaseIdRef.current === targetReleaseId) {
                setIsPreparingGitHub(false);
            }
        }
    };

    const handleCheckGitHubStatus = async () => {
        if (!selectedRelease?.id) return;
        const targetReleaseId = selectedRelease.id;
        if (isMutating) return;
        await fetchGitHubStatus(targetReleaseId);
    };

    // Publish Handler (Module 3B-2 Authoritative Guardrails)
    const handlePublishRelease = async () => {
        if (!selectedRelease?.id) return;
        const targetReleaseId = selectedRelease.id;

        if (isMutating) {
            setPublishError('Another operation is currently in progress.');
            return;
        }

        if (selectedRelease.status !== 'draft') {
            setPublishError('Only draft releases can be published.');
            return;
        }
        if (isValidationLoading || !validation || !validation.valid) {
            setPublishError('Release validation must pass before publishing.');
            return;
        }
        if (!githubStatus) {
            setPublishError('GitHub release status must be checked and ready before publishing.');
            return;
        }
        if (githubStatus.status !== 'ready') {
            setPublishError('GitHub release is not ready (synchronization state must be ready).');
            return;
        }

        const trimmedConfirm = confirmVersionInput.trim();
        if (!trimmedConfirm) {
            setPublishError('Version confirmation is required.');
            return;
        }
        if (trimmedConfirm !== selectedRelease.version) {
            setPublishError(`Version confirmation does not match "${selectedRelease.version}".`);
            return;
        }

        setIsPublishing(true);
        setPublishError(null);
        try {
            await ReleasesApi.publishRelease(targetReleaseId, trimmedConfirm);

            // Authoritative server check
            const updatedRelease = await ReleasesApi.getRelease(targetReleaseId);

            if (activeReleaseIdRef.current === targetReleaseId) {
                if (updatedRelease.status === 'published') {
                    setSelectedRelease(updatedRelease);
                    setPublishSuccessMessage(`✓ Modpack v${updatedRelease.version} published successfully!`);
                    setConfirmVersionInput('');
                    await fetchModpacks();
                } else {
                    setPublishError('Publish failed: release status was not updated to published on the server.');
                    setSelectedRelease(updatedRelease);
                    await fetchModpacks();
                }
            }
        } catch (err: unknown) {
            if (activeReleaseIdRef.current === targetReleaseId) {
                setPublishError(formatApiErrorMessage(err));
            }
        } finally {
            if (activeReleaseIdRef.current === targetReleaseId) {
                setIsPublishing(false);
            }
        }
    };

    const handleDeleteModpackEverywhere = async () => {
        if (!selectedRelease?.id) return;
        const targetReleaseId = selectedRelease.id;

        if (isMutating) {
            setDeleteDraftError('Another operation is currently in progress.');
            return;
        }

        if (!['draft', 'published', 'deprecated'].includes(selectedRelease.status)) {
            setDeleteDraftError('Cannot delete release with invalid status.');
            return;
        }

        const trimmedConfirmVer = confirmDeleteInput.trim();
        const trimmedConfirmPhrase = confirmDeletePhraseInput.trim();

        if (!trimmedConfirmVer) {
            setDeleteDraftError('Version confirmation is required to delete this release.');
            return;
        }
        if (trimmedConfirmVer !== selectedRelease.version) {
            setDeleteDraftError(`Version confirmation does not match "${selectedRelease.version}".`);
            return;
        }
        if (!trimmedConfirmPhrase) {
            setDeleteDraftError('Confirmation phrase is required to delete this release.');
            return;
        }
        if (trimmedConfirmPhrase !== `DELETE ${selectedRelease.version}`) {
            setDeleteDraftError(`Confirmation phrase does not match "DELETE ${selectedRelease.version}".`);
            return;
        }

        setIsDeletingDraft(true);
        setDeleteDraftError(null);
        setPartialDeletionInfo(null);

        try {
            await ReleasesApi.deleteModpackEverywhere(targetReleaseId, trimmedConfirmVer, trimmedConfirmPhrase);

            if (activeReleaseIdRef.current === targetReleaseId) {
                // Successful deletion: close workspace, reset draft state, reload modpacks list
                setSelectedRelease(null);
                activeReleaseIdRef.current = null;
                setFiles([]);
                setValidation(null);
                setEditingFile(null);
                setFileActionError(null);
                setFilesError(null);
                setValidationError(null);
                setPrepareResult(null);
                setGithubStatus(null);
                setPrepareError(null);
                setGithubStatusError(null);
                setPublishError(null);
                setPublishSuccessMessage(null);
                setConfirmVersionInput('');
                setConfirmDeleteInput('');
                setConfirmDeletePhraseInput('');
                setDeleteDraftError(null);
                setPartialDeletionInfo(null);
                await fetchModpacks();
            }
        } catch (err: unknown) {
            if (activeReleaseIdRef.current === targetReleaseId) {
                if (err instanceof ApiClientError && err.deletion_steps && err.error !== 'PURGE_ENDPOINT_UNAVAILABLE') {
                    setPartialDeletionInfo({
                        message: err.message,
                        steps: err.deletion_steps,
                        resolution: err.github_resolution
                    });
                } else {
                    setPartialDeletionInfo(null);
                }
                setDeleteDraftError(formatApiErrorMessage(err));
            }
        } finally {
            if (activeReleaseIdRef.current === targetReleaseId) {
                setIsDeletingDraft(false);
            }
        }
    };

    // Filter strictly for modpacks
    const modpackReleases = releases ? releases.filter((r) => r.release_type === 'modpack') : [];
    const totalModpacks = modpackReleases.length;
    const draftModpacks = modpackReleases.filter((r) => r.status === 'draft').length;
    const publishedModpacks = modpackReleases.filter((r) => r.status === 'published').length;
    const deprecatedModpacks = modpackReleases.filter((r) => r.status === 'deprecated').length;

    const isDraft = selectedRelease?.status === 'draft';
    const isValidationValid = validation?.valid === true;
    const isGitHubReady = githubStatus?.status === 'ready';

    return (
        <div className="modpack-page">
            <PageHeader
                title="Modpack Manager"
                subtitle="Create and manage LauncherXD modpack updates."
            />

            {isLoading && (
                <div data-testid="modpack-loading" className="state-loading">
                    Loading modpacks...
                </div>
            )}

            {fetchError && (
                <div role="alert" className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Failed to load modpacks</div>
                    <div>{fetchError}</div>
                </div>
            )}

            {!isLoading && !fetchError && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Left Column: Metrics & Modpack Table */}
                    <div>
                        {/* 1. Status Panel */}
                        <div
                            className="dashboard-grid"
                            style={{
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1.5rem'
                            }}
                            data-testid="modpack-stats-panel"
                        >
                            <div className="metric-card" style={{ padding: '1rem' }} data-testid="stat-total">
                                <span className="metric-title">Total Modpacks</span>
                                <div className="metric-value" style={{ fontSize: '1.75rem', margin: '0.25rem 0 0' }}>
                                    {totalModpacks}
                                </div>
                            </div>
                            <div className="metric-card" style={{ padding: '1rem' }} data-testid="stat-drafts">
                                <span className="metric-title">Drafts</span>
                                <div className="metric-value" style={{ fontSize: '1.75rem', margin: '0.25rem 0 0', color: '#fbbf24' }}>
                                    {draftModpacks}
                                </div>
                            </div>
                            <div className="metric-card" style={{ padding: '1rem' }} data-testid="stat-published">
                                <span className="metric-title">Published</span>
                                <div className="metric-value" style={{ fontSize: '1.75rem', margin: '0.25rem 0 0', color: '#34d399' }}>
                                    {publishedModpacks}
                                </div>
                            </div>
                            <div className="metric-card" style={{ padding: '1rem' }} data-testid="stat-deprecated">
                                <span className="metric-title">Deprecated</span>
                                <div className="metric-value" style={{ fontSize: '1.75rem', margin: '0.25rem 0 0', color: '#f87171' }}>
                                    {deprecatedModpacks}
                                </div>
                            </div>
                        </div>

                        {/* 2. Modpack Releases Table */}
                        <section aria-labelledby="modpack-releases-heading" className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <h2 id="modpack-releases-heading" className="card-title">Modpack releases</h2>
                                <span className="badge badge-modpack">{totalModpacks} releases</span>
                            </div>

                            {modpackReleases.length === 0 ? (
                                <div className="state-empty" style={{ padding: '2.5rem 1rem', textAlign: 'center' }} data-testid="modpack-empty-state">
                                    No modpack releases found.
                                </div>
                            ) : (
                                <div className="table-container" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                                    <table className="data-table" aria-label="Modpack Releases Table">
                                        <thead>
                                            <tr>
                                                <th>Version</th>
                                                <th>Channel</th>
                                                <th>Status</th>
                                                <th>Release notes</th>
                                                <th>Updated</th>
                                                <th className="cell-actions">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modpackReleases.map((r) => {
                                                const isSelected = selectedRelease?.id === r.id;
                                                return (
                                                    <tr
                                                        key={r.id}
                                                        data-testid={`modpack-row-${r.id}`}
                                                        style={isSelected ? { backgroundColor: 'var(--bg-surface-elevated)' } : undefined}
                                                    >
                                                        <td style={{ fontWeight: 600 }}>{r.version}</td>
                                                        <td>
                                                            <span className={r.channel === 'stable' ? 'badge badge-stable' : 'badge badge-beta'}>
                                                                {r.channel}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge badge-${r.status}`}>
                                                                {r.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.release_notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                            {r.release_notes || 'No release notes'}
                                                        </td>
                                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                            {new Date(r.updated_at).toLocaleDateString(undefined, {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </td>
                                                        <td className="cell-actions">
                                                            {r.status === 'draft' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectRelease(r)}
                                                                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                                                    disabled={isMutating}
                                                                    data-testid={`configure-modpack-${r.id}`}
                                                                >
                                                                    Configure
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectRelease(r)}
                                                                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                                                    disabled={isMutating}
                                                                    data-testid={`view-modpack-${r.id}`}
                                                                >
                                                                    View
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column: Create modpack draft form */}
                    <div>
                        <div className="card" data-testid="create-modpack-card">
                            <div className="card-header">
                                <h2 className="card-title">Create modpack draft</h2>
                            </div>

                            {successMessage && (
                                <div role="status" className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
                                    ✓ {successMessage}
                                </div>
                            )}

                            {createError && (
                                <div role="alert" className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                                    {createError}
                                </div>
                            )}

                            <form onSubmit={handleCreateDraft} noValidate>
                                <div className="form-group">
                                    <label htmlFor="modpack-version" className="form-label">
                                        Version: <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    </label>
                                    <input
                                        id="modpack-version"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. 1.0.0"
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modpack-channel" className="form-label">
                                        Channel:
                                    </label>
                                    <select
                                        id="modpack-channel"
                                        className="form-control"
                                        value={channel}
                                        onChange={(e) => setChannel(e.target.value as ReleaseChannel)}
                                        disabled={isSubmitting}
                                    >
                                        <option value="stable">Stable</option>
                                        <option value="beta">Beta</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="modpack-notes" className="form-label">
                                        Release notes (optional):
                                    </label>
                                    <textarea
                                        id="modpack-notes"
                                        className="form-control"
                                        placeholder="Summary of modpack changes..."
                                        rows={3}
                                        value={releaseNotes}
                                        onChange={(e) => setReleaseNotes(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ width: '100%' }}
                                        disabled={isSubmitting}
                                        data-testid="create-draft-btn"
                                    >
                                        {isSubmitting ? 'Creating...' : 'Create draft'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Inline Workspace (Rendered when a release is selected) */}
            {selectedRelease ? (
                <section
                    className="card"
                    data-testid="modpack-workspace-section"
                    style={{
                        marginTop: '2rem',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-surface)'
                    }}
                >
                    <div
                        className="card-header"
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '1rem'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <h2 className="card-title" style={{ fontSize: '1.25rem' }}>
                                Workspace: v{selectedRelease.version}
                            </h2>
                            <span className={selectedRelease.channel === 'stable' ? 'badge badge-stable' : 'badge badge-beta'}>
                                {selectedRelease.channel}
                            </span>
                            <span className={`badge badge-${selectedRelease.status}`}>
                                {selectedRelease.status}
                            </span>
                            <span className="badge badge-modpack">
                                modpack
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleCloseWorkspace}
                            className="btn btn-secondary btn-sm"
                            disabled={isMutating}
                            data-testid="close-workspace-btn"
                        >
                            Close workspace
                        </button>
                    </div>

                    <div style={{ padding: '1.5rem 0 0' }}>
                        {/* Files Section */}
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
                                    Modpack Files
                                </h3>
                            </div>

                            {fileActionError && (
                                <div role="alert" className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                                    {fileActionError}
                                </div>
                            )}

                            <ReleaseFilesTable
                                releaseId={selectedRelease.id}
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
                                onAssetUploaded={handleAssetUploaded}
                            />

                            {isDraft && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    {editingFile ? (
                                        <ReleaseFileForm
                                            releaseId={selectedRelease.id}
                                            initialData={editingFile}
                                            onSubmit={handleUpdateFile}
                                            onCancel={() => {
                                                setEditingFile(null);
                                                setFileActionError(null);
                                            }}
                                            onSuccess={async () => {
                                                await fetchWorkspaceFiles(selectedRelease.id);
                                                await fetchWorkspaceValidation(selectedRelease.id);
                                                if (prepareResultRef.current || githubStatusRef.current) {
                                                    await fetchGitHubStatus(selectedRelease.id);
                                                }
                                            }}
                                            isSubmitting={isUpdatingFile}
                                            submitLabel="Save Changes"
                                        />
                                    ) : (
                                        <ReleaseFileForm
                                            releaseId={selectedRelease.id}
                                            onSubmit={handleAddFile}
                                            onSuccess={async () => {
                                                await fetchWorkspaceFiles(selectedRelease.id);
                                                await fetchWorkspaceValidation(selectedRelease.id);
                                                if (prepareResultRef.current || githubStatusRef.current) {
                                                    await fetchGitHubStatus(selectedRelease.id);
                                                }
                                            }}
                                            isSubmitting={isAddingFile}
                                            submitLabel="Add File"
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Validation Section */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
                                    Release Readiness & Validation
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => fetchWorkspaceValidation(selectedRelease.id)}
                                    disabled={isValidationLoading}
                                    className="btn btn-secondary btn-sm"
                                    data-testid="revalidate-btn"
                                >
                                    {isValidationLoading ? 'Validating...' : 'Re-validate'}
                                </button>
                            </div>

                            {isValidationLoading && (
                                <div data-testid="validation-loading" className="state-loading">
                                    Loading validation status...
                                </div>
                            )}

                            {validationError && (
                                <div role="alert" className="alert alert-danger" style={{ marginTop: '0.5rem' }}>
                                    {validationError}
                                </div>
                            )}

                            {!isValidationLoading && !validationError && validation && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    {validation.valid ? (
                                        <div className="alert alert-success" style={{ fontWeight: 600 }} data-testid="validation-success-banner">
                                            ✓ Release is valid and ready for publishing.
                                        </div>
                                    ) : (
                                        <div className="alert alert-warning" data-testid="validation-warning-banner">
                                            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                                                ⚠ Release is not ready for publishing. The following issues were found:
                                            </div>
                                            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                                                {validation.issues.map((issue, idx) => (
                                                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                                        <strong>{issue.code}:</strong> {issue.message || 'Validation failed'}
                                                        {issue.path ? ` (${issue.path})` : ''}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* GitHub Release & Assets Status Section (Module 3B-2) */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
                                    GitHub Release & Assets Status
                                </h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {isDraft && (
                                        <button
                                            type="button"
                                            onClick={handlePrepareGitHub}
                                            disabled={!isValidationValid || isValidationLoading || isMutating}
                                            className="btn btn-primary btn-sm"
                                            data-testid="prepare-github-btn"
                                        >
                                            {isPreparingGitHub ? 'Preparing...' : 'Prepare GitHub Release'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleCheckGitHubStatus}
                                        disabled={isMutating}
                                        className="btn btn-secondary btn-sm"
                                        data-testid="check-github-status-btn"
                                    >
                                        {isCheckingGitHub ? 'Checking...' : 'Check GitHub Status'}
                                    </button>
                                </div>
                            </div>

                            {isPreparingGitHub && (
                                <div data-testid="github-preparing-loading" className="state-loading" style={{ marginBottom: '1rem' }}>
                                    Preparing release on GitHub...
                                </div>
                            )}

                            {isCheckingGitHub && (
                                <div data-testid="github-checking-loading" className="state-loading" style={{ marginBottom: '1rem' }}>
                                    Checking GitHub release status...
                                </div>
                            )}

                            {prepareError && (
                                <div role="alert" className="alert alert-danger" data-testid="prepare-error-alert" style={{ marginBottom: '1rem' }}>
                                    {prepareError}
                                </div>
                            )}

                            {githubStatusError && (
                                <div role="alert" className="alert alert-danger" data-testid="github-error-alert" style={{ marginBottom: '1rem' }}>
                                    {githubStatusError}
                                </div>
                            )}

                            {prepareResult && (
                                <div className="alert alert-success" data-testid="prepare-success-alert" style={{ marginBottom: '1rem' }}>
                                    <div>
                                        Draft release prepared on GitHub! Tag: <code>{prepareResult.github_tag}</code> (ID: {prepareResult.github_release_id})
                                    </div>
                                    {prepareResult.expectedAssets && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }} data-testid="expected-assets-info">
                                            <strong>Expected Assets ({prepareResult.expectedAssets.length}):</strong>{' '}
                                            {prepareResult.expectedAssets.map((a) => a.name).join(', ') || 'None'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!prepareResult && !githubStatus && !isCheckingGitHub && !isPreparingGitHub && (
                                <div className="state-empty" data-testid="github-unprepared-notice" style={{ padding: '1rem', margin: '0.5rem 0' }}>
                                    GitHub release has not been prepared yet. Click &quot;Prepare GitHub Release&quot; once validation passes.
                                </div>
                            )}

                            {githubStatus && (
                                <div data-testid="github-status-details" style={{ marginTop: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <strong style={{ color: 'var(--text-secondary)' }}>Synchronization State:</strong>
                                        <span
                                            className={githubStatus.status === 'ready' ? 'badge badge-ready' : 'badge badge-beta'}
                                            data-testid="github-sync-badge"
                                        >
                                            {githubStatus.status}
                                        </span>
                                    </div>

                                    <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                                        Asset Status Mapping:
                                    </h4>
                                    <div className="table-container" style={{ border: '1px solid var(--border-subtle)' }}>
                                        <table className="data-table" aria-label="GitHub Asset Statuses Table">
                                            <thead>
                                                <tr>
                                                    <th>File Path</th>
                                                    <th>Asset Status</th>
                                                    <th>GitHub Asset ID</th>
                                                    <th>Download URL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {files.map((f) => {
                                                    const stat = githubStatus.assetStatuses[f.id];
                                                    const isReady = stat?.status === 'ready';
                                                    return (
                                                        <tr key={f.id} data-testid={`github-asset-row-${f.id}`}>
                                                            <td style={{ fontWeight: 500 }}>{f.path}</td>
                                                            <td>
                                                                <span
                                                                    className={isReady ? 'badge badge-ready' : 'badge badge-danger'}
                                                                    data-testid={`github-asset-status-${f.id}`}
                                                                >
                                                                    {stat?.status || 'unknown'}
                                                                </span>
                                                            </td>
                                                            <td>{stat?.github_asset_id ? `#${stat.github_asset_id}` : '—'}</td>
                                                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {stat?.download_url ? (
                                                                    <a href={stat.download_url} target="_blank" rel="noreferrer" data-testid={`download-url-${f.id}`}>
                                                                        {stat.download_url}
                                                                    </a>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {githubStatus.unexpectedAssets && githubStatus.unexpectedAssets.length > 0 ? (
                                        <div className="alert alert-warning" data-testid="unexpected-assets-alert" style={{ marginTop: '1rem' }}>
                                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                                                ⚠ Unexpected Assets found on GitHub:
                                            </div>
                                            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                                                {githubStatus.unexpectedAssets.map((u) => (
                                                    <li key={u.id}>
                                                        {u.name} (ID: {u.id})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div className="alert alert-success" data-testid="no-unexpected-assets" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                                            ✓ No unexpected assets found on GitHub.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Publish Modpack Section (Module 3B-2) */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                                Publish Modpack Release
                            </h3>

                            {publishSuccessMessage && (
                                <div role="status" className="alert alert-success" data-testid="publish-success-alert" style={{ marginBottom: '1rem' }}>
                                    {publishSuccessMessage}
                                </div>
                            )}

                            {publishError && (
                                <div role="alert" className="alert alert-danger" data-testid="publish-error-alert" style={{ marginBottom: '1rem' }}>
                                    {publishError}
                                </div>
                            )}

                            {selectedRelease.status === 'published' ? (
                                <div className="alert alert-info" data-testid="already-published-alert">
                                    ✓ This modpack release is published and read-only.
                                </div>
                            ) : selectedRelease.status === 'deprecated' ? (
                                <div className="alert alert-warning" data-testid="already-deprecated-alert">
                                    This modpack release is deprecated.
                                </div>
                            ) : (
                                <div data-testid="publish-controls" style={{ maxWidth: '600px' }}>
                                    <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Publishing will make this modpack version live for players. This action cannot be undone.
                                    </div>

                                    {!isValidationValid && (
                                        <div className="alert alert-warning" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                            ⚠ Release validation must pass before you can publish.
                                        </div>
                                    )}

                                    {!isGitHubReady && (
                                        <div className="alert alert-warning" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                                            ⚠ GitHub release must be prepared and in ready state before you can publish.
                                        </div>
                                    )}

                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label htmlFor="confirm-version-input" className="form-label">
                                            Confirm version to publish: <span style={{ color: 'var(--color-danger)' }}>*</span>
                                        </label>
                                        <input
                                            id="confirm-version-input"
                                            type="text"
                                            className="form-control"
                                            placeholder={`Type "${selectedRelease.version}" to confirm`}
                                            value={confirmVersionInput}
                                            onChange={(e) => setConfirmVersionInput(e.target.value)}
                                            disabled={!isValidationValid || !isGitHubReady || isMutating}
                                            data-testid="confirm-version-input"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handlePublishRelease}
                                        disabled={!isValidationValid || !isGitHubReady || isMutating}
                                        className="btn btn-primary"
                                        data-testid="publish-release-btn"
                                    >
                                        {isPublishing ? 'Publishing...' : 'Publish Modpack'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Danger Zone: Delete / Purge Everywhere (Phase 7F) */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }} data-testid="danger-zone-section">
                            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-danger)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span aria-hidden="true">⚠</span> Danger Zone
                            </h3>

                            {selectedRelease.status !== 'draft' && (
                                <div className="alert alert-warning" data-testid="published-release-warning" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                                    ⚠ <strong>Caution:</strong> This release is currently <strong>{selectedRelease.status}</strong>. Purging will delete its GitHub release, Git tag, and all database records immediately.
                                </div>
                            )}

                            <div data-testid="draft-danger-zone-controls" style={{ maxWidth: '600px', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    Permanently delete this modpack release, including its GitHub release and assets (if created), git tag, and D1 database records. This action cannot be undone.
                                </p>

                                {partialDeletionInfo ? (
                                    <div role="alert" className="alert alert-danger" data-testid="delete-draft-partial-alert" style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Partial deletion</div>
                                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6', fontFamily: 'monospace' }}>
                                            <div>GitHub Release: <strong>{partialDeletionInfo.steps.github_release}</strong></div>
                                            <div>Git tag: <strong>{partialDeletionInfo.steps.github_tag}</strong></div>
                                            <div>D1 metadata: <strong>{partialDeletionInfo.steps.d1}</strong></div>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                            You may safely retry this operation.
                                        </div>
                                    </div>
                                ) : deleteDraftError ? (
                                    <div role="alert" className="alert alert-danger" data-testid="delete-draft-error-alert" style={{ marginBottom: '1rem' }}>
                                        {deleteDraftError}
                                    </div>
                                ) : null}

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="confirm-delete-version-input" className="form-label" style={{ fontSize: '0.85rem' }}>
                                        To confirm, type <strong style={{ color: 'var(--text-primary)' }}>{selectedRelease.version}</strong> below:
                                    </label>
                                    <input
                                        id="confirm-delete-version-input"
                                        type="text"
                                        className="form-control"
                                        placeholder={`Type "${selectedRelease.version}" to confirm`}
                                        value={confirmDeleteInput}
                                        onChange={(e) => setConfirmDeleteInput(e.target.value)}
                                        disabled={isMutating}
                                        data-testid="confirm-delete-version-input"
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="confirm-delete-phrase-input" className="form-label" style={{ fontSize: '0.85rem' }}>
                                        To confirm permanent purge, type <strong style={{ color: 'var(--text-primary)' }}>DELETE {selectedRelease.version}</strong> below:
                                    </label>
                                    <input
                                        id="confirm-delete-phrase-input"
                                        type="text"
                                        className="form-control"
                                        placeholder={`Type "DELETE ${selectedRelease.version}" to confirm`}
                                        value={confirmDeletePhraseInput}
                                        onChange={(e) => setConfirmDeletePhraseInput(e.target.value)}
                                        disabled={isMutating}
                                        data-testid="confirm-delete-phrase-input"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleDeleteModpackEverywhere}
                                    disabled={
                                        isMutating ||
                                        confirmDeleteInput.trim() !== selectedRelease.version ||
                                        confirmDeletePhraseInput.trim() !== `DELETE ${selectedRelease.version}`
                                    }
                                    className="btn btn-danger"
                                    data-testid="delete-draft-everywhere-btn"
                                >
                                    {isDeletingDraft ? 'Deleting everywhere...' : 'Delete modpack everywhere'}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                <div
                    className="card"
                    style={{
                        marginTop: '2rem',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px dashed var(--border-subtle)'
                    }}
                    data-testid="modpack-workspace-placeholder"
                >
                    <div className="card-header" style={{ paddingBottom: '0.5rem' }}>
                        <span className="card-title" style={{ fontSize: '0.95rem' }}>
                            Modpack update workspace
                        </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Select or create a draft to configure files in the next module.
                    </div>
                </div>
            )}
        </div>
    );
};
