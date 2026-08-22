import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';

export const SkinsPage: React.FC = () => {
    return (
        <div className="skins-page" data-testid="skins-page">
            <PageHeader
                title="Skin Management"
                subtitle="Manage player skin profiles, cape assignments, and global launcher textures."
                badge={
                    <span className="badge badge-warning" data-testid="skins-integration-badge">
                        Waiting for launcher skin contract
                    </span>
                }
            />

            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                ℹ Skin cloud storage and launcher synchronization will be enabled after the launcher skin contract is merged.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Column: Player Profiles Table & Global Launcher Textures */}
                <div>
                    {/* Player Profiles Table Card */}
                    <div className="card" data-testid="skins-profiles-section" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <h2 className="card-title">Player Skin Profiles</h2>
                            <span className="badge">0 profiles</span>
                        </div>

                        <div className="table-container" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                            <table className="data-table" data-testid="skins-table" aria-label="Player Skin Profiles Table">
                                <thead>
                                    <tr>
                                        <th>Player</th>
                                        <th>Skin</th>
                                        <th>Cape</th>
                                        <th>Updated</th>
                                        <th className="cell-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                                            <div className="empty-state" data-testid="skins-empty-state">
                                                <h3 className="empty-state-title" style={{ fontSize: '1rem' }}>No player skin profiles configured</h3>
                                                <p className="empty-state-description">
                                                    Player textures and Cape bindings will sync with the launcher client once the skin contract is available.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Global Launcher Textures Section */}
                    <div className="card" data-testid="skins-global-textures-section">
                        <div className="card-header">
                            <h2 className="card-title">Global Launcher Textures</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                            Default textures, launcher UI skins, and fallback assets for unauthenticated players.
                        </p>

                        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="texture-name-input">Texture Name:</label>
                                <input
                                    id="texture-name-input"
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Default Steve HD"
                                    disabled
                                    data-testid="texture-name-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="texture-type-select">Texture Type:</label>
                                <select
                                    id="texture-type-select"
                                    className="form-control"
                                    defaultValue="steve"
                                    disabled
                                    data-testid="texture-type-select"
                                >
                                    <option value="steve">Default Steve (Classic)</option>
                                    <option value="alex">Default Alex (Slim)</option>
                                    <option value="background">Launcher Background</option>
                                    <option value="cape">Standard Community Cape</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label" htmlFor="texture-desc-input">Description:</label>
                                <input
                                    id="texture-desc-input"
                                    type="text"
                                    className="form-control"
                                    placeholder="Optional description of the texture asset"
                                    disabled
                                    data-testid="texture-desc-input"
                                />
                            </div>

                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label" htmlFor="texture-file-input">Texture File (.png):</label>
                                <input
                                    id="texture-file-input"
                                    type="file"
                                    className="form-control"
                                    disabled
                                    data-testid="texture-file-input"
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" disabled data-testid="upload-texture-btn">
                                    Upload Global Texture
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Column: Player Profile Form & 3D Skin Preview */}
                <div>
                    {/* Player Profile Form Card */}
                    <div className="card" data-testid="skin-profile-form-card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <h2 className="card-title">Assign Skin / Cape</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                            Bind skins or capes to specific Minecraft player usernames.
                        </p>

                        <form onSubmit={(e) => e.preventDefault()} data-testid="skin-profile-form">
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="skin-player-name-input">
                                    Minecraft Player Name:
                                </label>
                                <input
                                    id="skin-player-name-input"
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Steve"
                                    disabled
                                    data-testid="skin-player-name-input"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="skin-url-input">
                                    Skin Texture URL:
                                </label>
                                <input
                                    id="skin-url-input"
                                    type="url"
                                    className="form-control"
                                    placeholder="https://textures.minecraft.net/texture/..."
                                    disabled
                                    data-testid="skin-url-input"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="cape-url-input">
                                    Cape Texture URL:
                                </label>
                                <input
                                    id="cape-url-input"
                                    type="url"
                                    className="form-control"
                                    placeholder="https://textures.minecraft.net/texture/..."
                                    disabled
                                    data-testid="cape-url-input"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="skin-file-input">
                                    Or Upload Skin PNG (64x64):
                                </label>
                                <input
                                    id="skin-file-input"
                                    type="file"
                                    className="form-control"
                                    disabled
                                    data-testid="skin-file-input"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" htmlFor="cape-file-input">
                                    Or Upload Cape PNG (64x32):
                                </label>
                                <input
                                    id="cape-file-input"
                                    type="file"
                                    className="form-control"
                                    disabled
                                    data-testid="cape-file-input"
                                />
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled
                                data-testid="save-skin-profile-btn"
                            >
                                Save Skin Profile
                            </button>
                        </form>
                    </div>

                    {/* Skin Preview Box */}
                    <div className="card" data-testid="skin-preview-card">
                        <div className="card-header">
                            <h2 className="card-title">Texture Preview</h2>
                        </div>
                        <div
                            data-testid="skin-preview-box"
                            style={{
                                background: '#040711',
                                borderRadius: 'var(--radius-md)',
                                border: '1px dashed var(--border-subtle)',
                                height: '180px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem'
                            }}
                        >
                            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem', opacity: 0.5 }}>🧍</div>
                            <div>3D Skin Preview: Waiting for skin asset</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
