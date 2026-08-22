import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';

export const BackupsPage: React.FC = () => {
    return (
        <div className="backups-page" data-testid="backups-page">
            <PageHeader
                title="Server Backups"
                subtitle="World backup archives, automated scheduling, and restore points."
                badge={
                    <span className="badge badge-warning" data-testid="backups-integration-badge">
                        Waiting for ZeroDactyl integration
                    </span>
                }
            />

            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                ℹ Backups represent server world and configuration files. Their storage provider has not been configured yet.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Column: Backups Table */}
                <div>
                    <div className="card" data-testid="backups-table-card">
                        <div className="card-header">
                            <h2 className="card-title">Backup Archives</h2>
                            <span className="badge">0 backups</span>
                        </div>

                        <div className="table-container" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                            <table className="data-table" data-testid="backups-table" aria-label="Server Backups Table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Size</th>
                                        <th>Created</th>
                                        <th>Storage</th>
                                        <th className="cell-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                            <div className="empty-state" data-testid="backups-empty-state">
                                                <h3 className="empty-state-title" style={{ fontSize: '1rem' }}>No backups available yet</h3>
                                                <p className="empty-state-description">
                                                    Backups will appear here once the backup daemon and storage provider are connected.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Create Backup Card */}
                <div>
                    <div className="card" data-testid="create-backup-card">
                        <div className="card-header">
                            <h2 className="card-title">Create New Backup</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                            Generate an on-demand snapshot of server world files and configurations.
                        </p>

                        <form onSubmit={(e) => e.preventDefault()}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="backup-name-input">
                                    Backup Name (optional):
                                </label>
                                <input
                                    id="backup-name-input"
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Pre-update-world-backup"
                                    disabled
                                    data-testid="backup-name-input"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label" htmlFor="backup-type-select">
                                    Backup Scope / Type:
                                </label>
                                <select
                                    id="backup-type-select"
                                    className="form-control"
                                    defaultValue="full"
                                    disabled
                                    data-testid="backup-type-select"
                                >
                                    <option value="full">Full Server (World + Mods + Configs)</option>
                                    <option value="world">World Only (Overworld, Nether, End)</option>
                                    <option value="plugins">Plugins / Mods & Configurations</option>
                                    <option value="config">Configurations Only</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'not-allowed' }}>
                                    <input type="checkbox" disabled />
                                    <span>Lock server state during snapshot</span>
                                </label>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled
                                data-testid="create-backup-btn"
                            >
                                Create Backup
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
