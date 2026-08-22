import React, { useState, useEffect, useCallback } from 'react';
import { CredentialsApi } from '../api/credentials';
import { formatApiErrorMessage } from '../api/client';
import type { CredentialsStatusResponse } from '../types/credentials';

export const LocalCredentialsSection: React.FC = () => {
    const [status, setStatus] = useState<CredentialsStatusResponse | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form states for Admin
    const [isAdminEditing, setIsAdminEditing] = useState<boolean>(false);
    const [adminTokenInput, setAdminTokenInput] = useState<string>('');
    const [isAdminSaving, setIsAdminSaving] = useState<boolean>(false);

    // Form states for GitHub
    const [isGitHubEditing, setIsGitHubEditing] = useState<boolean>(false);
    const [githubTokenInput, setGithubTokenInput] = useState<string>('');
    const [isGitHubSaving, setIsGitHubSaving] = useState<boolean>(false);

    const fetchStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await CredentialsApi.getStatus();
            setStatus(res);
        } catch {
            setStatus({ admin: { configured: false }, github: { configured: false } });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleSaveAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminTokenInput.trim()) return;

        setIsAdminSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await CredentialsApi.saveAdminToken(adminTokenInput.trim());
            setAdminTokenInput('');
            setIsAdminEditing(false);
            setSuccessMessage('Admin API credential saved securely.');
            await fetchStatus();
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err));
        } finally {
            setIsAdminSaving(false);
        }
    };

    const handleRemoveAdmin = async () => {
        setIsAdminSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await CredentialsApi.removeAdminToken();
            setAdminTokenInput('');
            setIsAdminEditing(false);
            setSuccessMessage('Admin API credential removed.');
            await fetchStatus();
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err));
        } finally {
            setIsAdminSaving(false);
        }
    };

    const handleSaveGitHub = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!githubTokenInput.trim()) return;

        setIsGitHubSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await CredentialsApi.saveGitHubToken(githubTokenInput.trim());
            setGithubTokenInput('');
            setIsGitHubEditing(false);
            setSuccessMessage('GitHub Releases credential saved securely.');
            await fetchStatus();
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err));
        } finally {
            setIsGitHubSaving(false);
        }
    };

    const handleRemoveGitHub = async () => {
        setIsGitHubSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await CredentialsApi.removeGitHubToken();
            setGithubTokenInput('');
            setIsGitHubEditing(false);
            setSuccessMessage('GitHub Releases credential removed.');
            await fetchStatus();
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err));
        } finally {
            setIsGitHubSaving(false);
        }
    };

    return (
        <section aria-labelledby="local-credentials-heading" style={{ marginTop: '2rem' }}>
            <div className="card">
                <div className="card-header">
                    <div>
                        <h2 id="local-credentials-heading" className="card-title">Local Credentials</h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Secure credential storage bound to your Windows user account. Survives restarts without environment variables.
                        </p>
                    </div>
                </div>

                {error && (
                    <div role="alert" className="alert alert-danger" style={{ margin: '1rem' }}>
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="alert alert-success" style={{ margin: '1rem' }}>
                        {successMessage}
                    </div>
                )}

                {isLoading ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading credential status...
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', padding: '1.5rem' }}>
                        {/* Admin API Card */}
                        <div className="credential-card" data-testid="credential-card-admin">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Admin API</h3>
                                <span
                                    className={status?.admin.configured ? 'badge badge-ready' : 'badge badge-draft'}
                                    aria-label={`Admin API ${status?.admin.configured ? 'Configured' : 'Not configured'}`}
                                >
                                    {status?.admin.configured ? 'Configured' : 'Not configured'}
                                </span>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Used for authenticating local backend calls to Cloudflare Worker admin endpoints.
                            </p>

                            {isAdminEditing ? (
                                <form onSubmit={handleSaveAdmin}>
                                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                        <label htmlFor="admin-token-input" className="form-label" style={{ fontSize: '0.85rem' }}>
                                            Admin API Token:
                                        </label>
                                        <input
                                            id="admin-token-input"
                                            type="password"
                                            value={adminTokenInput}
                                            onChange={(e) => setAdminTokenInput(e.target.value)}
                                            placeholder="Enter Admin API Token"
                                            className="form-control"
                                            disabled={isAdminSaving}
                                            autoComplete="off"
                                            required
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="submit"
                                            disabled={isAdminSaving || !adminTokenInput.trim()}
                                            className="btn btn-primary btn-sm"
                                        >
                                            {isAdminSaving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAdminEditing(false);
                                                setAdminTokenInput('');
                                            }}
                                            disabled={isAdminSaving}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAdminEditing(true);
                                            setSuccessMessage(null);
                                            setError(null);
                                        }}
                                        className="btn btn-secondary btn-sm"
                                    >
                                        {status?.admin.configured ? 'Replace' : 'Configure'}
                                    </button>
                                    {status?.admin.configured && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveAdmin}
                                            disabled={isAdminSaving}
                                            className="btn btn-danger btn-sm"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* GitHub Releases Card */}
                        <div className="credential-card" data-testid="credential-card-github">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>GitHub Releases</h3>
                                <span
                                    className={status?.github.configured ? 'badge badge-ready' : 'badge badge-draft'}
                                    aria-label={`GitHub Releases ${status?.github.configured ? 'Configured' : 'Not configured'}`}
                                >
                                    {status?.github.configured ? 'Configured' : 'Not configured'}
                                </span>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Used for uploading binary release assets to GitHub repository.
                            </p>

                            {isGitHubEditing ? (
                                <form onSubmit={handleSaveGitHub}>
                                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                        <label htmlFor="github-token-input" className="form-label" style={{ fontSize: '0.85rem' }}>
                                            GitHub Token (PAT):
                                        </label>
                                        <input
                                            id="github-token-input"
                                            type="password"
                                            value={githubTokenInput}
                                            onChange={(e) => setGithubTokenInput(e.target.value)}
                                            placeholder="Enter GitHub PAT"
                                            className="form-control"
                                            disabled={isGitHubSaving}
                                            autoComplete="off"
                                            required
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="submit"
                                            disabled={isGitHubSaving || !githubTokenInput.trim()}
                                            className="btn btn-primary btn-sm"
                                        >
                                            {isGitHubSaving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsGitHubEditing(false);
                                                setGithubTokenInput('');
                                            }}
                                            disabled={isGitHubSaving}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsGitHubEditing(true);
                                            setSuccessMessage(null);
                                            setError(null);
                                        }}
                                        className="btn btn-secondary btn-sm"
                                    >
                                        {status?.github.configured ? 'Replace' : 'Configure'}
                                    </button>
                                    {status?.github.configured && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveGitHub}
                                            disabled={isGitHubSaving}
                                            className="btn btn-danger btn-sm"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};
