import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';

export const ServerPage: React.FC = () => {
    return (
        <div className="server-page" data-testid="server-page">
            <PageHeader
                title="Server Management"
                subtitle="Server instance lifecycle, connection monitoring, and server properties."
                badge={
                    <span className="badge badge-warning" data-testid="server-integration-badge">
                        Waiting for ZeroDactyl integration
                    </span>
                }
            />

            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                ℹ Server lifecycle actions and live telemetry will be enabled once the ZeroDactyl panel integration is completed. No remote connections or background sync requests are active.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Column: Server Status & Connected Players */}
                <div>
                    {/* Server Status Card */}
                    <div className="card" data-testid="server-status-card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                                <h2 className="card-title">Server Instance</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                                    Current instance runtime state and network endpoints.
                                </p>
                            </div>
                            <div className="actions-group">
                                <button type="button" className="btn btn-success btn-sm" disabled data-testid="server-start-btn">
                                    Start Server
                                </button>
                                <button type="button" className="btn btn-warning btn-sm" disabled data-testid="server-restart-btn">
                                    Restart
                                </button>
                                <button type="button" className="btn btn-danger btn-sm" disabled data-testid="server-stop-btn">
                                    Stop
                                </button>
                            </div>
                        </div>

                        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                            <div className="metric-card" style={{ padding: '1rem' }}>
                                <span className="metric-title">State</span>
                                <div className="metric-value" data-testid="server-status-val" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Not available
                                </div>
                            </div>
                            <div className="metric-card" style={{ padding: '1rem' }}>
                                <span className="metric-title">Address / Host</span>
                                <div className="metric-value" data-testid="server-address-val" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                                    Waiting for integration
                                </div>
                            </div>
                            <div className="metric-card" style={{ padding: '1rem' }}>
                                <span className="metric-title">Engine / Version</span>
                                <div className="metric-value" data-testid="server-version-val" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Not available
                                </div>
                            </div>
                            <div className="metric-card" style={{ padding: '1rem' }}>
                                <span className="metric-title">Players</span>
                                <div className="metric-value" data-testid="server-players-val" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    Not available
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Connected Players Panel */}
                    <div className="card" data-testid="server-players-panel">
                        <div className="card-header">
                            <h2 className="card-title">Connected Players</h2>
                            <span className="badge">0 active</span>
                        </div>
                        <div className="empty-state" data-testid="players-empty-state" style={{ padding: '2rem 1rem' }}>
                            <h3 className="empty-state-title" style={{ fontSize: '1rem' }}>No players connected</h3>
                            <p className="empty-state-description">
                                Player monitoring and kick/ban moderation will become available once the ZeroDactyl game daemon is configured.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Server Properties */}
                <div>
                    <div className="card" data-testid="server-properties-panel">
                        <div className="card-header">
                            <h2 className="card-title">Server Properties</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                            Core server configuration parameters (server.properties).
                        </p>

                        <form onSubmit={(e) => e.preventDefault()}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="prop-server-port">Server Port:</label>
                                <input
                                    id="prop-server-port"
                                    type="number"
                                    className="form-control"
                                    defaultValue={25565}
                                    disabled
                                    data-testid="prop-server-port"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="prop-max-players">Max Players:</label>
                                <input
                                    id="prop-max-players"
                                    type="number"
                                    className="form-control"
                                    defaultValue={20}
                                    disabled
                                    data-testid="prop-max-players"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="prop-motd">Message of the Day (MOTD):</label>
                                <input
                                    id="prop-motd"
                                    type="text"
                                    className="form-control"
                                    defaultValue="A Minecraft Server"
                                    disabled
                                    data-testid="prop-motd"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="prop-difficulty">Difficulty:</label>
                                <select
                                    id="prop-difficulty"
                                    className="form-control"
                                    defaultValue="normal"
                                    disabled
                                    data-testid="prop-difficulty"
                                >
                                    <option value="peaceful">Peaceful</option>
                                    <option value="easy">Easy</option>
                                    <option value="normal">Normal</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" htmlFor="prop-pvp">Player vs Player (PvP):</label>
                                <select
                                    id="prop-pvp"
                                    className="form-control"
                                    defaultValue="true"
                                    disabled
                                    data-testid="prop-pvp"
                                >
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled
                                data-testid="save-properties-btn"
                            >
                                Save Properties
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
