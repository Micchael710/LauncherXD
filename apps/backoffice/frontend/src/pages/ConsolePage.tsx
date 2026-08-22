import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';

export const ConsolePage: React.FC = () => {
    return (
        <div className="console-page" data-testid="console-page">
            <PageHeader
                title="Server Console"
                subtitle="Live server log streaming, command execution, and filter controls."
                badge={
                    <span className="badge badge-warning" data-testid="console-integration-badge">
                        Waiting for ZeroDactyl integration
                    </span>
                }
            />

            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                ℹ Live server log output and RCON command execution will be established once the ZeroDactyl daemon is configured.
            </div>

            <div className="card" data-testid="console-terminal-viewer">
                {/* Terminal Toolbar Controls */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        paddingBottom: '1rem',
                        borderBottom: '1px solid var(--border-color)',
                        marginBottom: '1rem'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <label htmlFor="log-level-filter" className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>
                            Level:
                        </label>
                        <select
                            id="log-level-filter"
                            className="form-control"
                            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                            disabled
                            data-testid="console-filter-select"
                        >
                            <option value="all">All Levels</option>
                            <option value="info">INFO only</option>
                            <option value="warn">WARN only</option>
                            <option value="error">ERROR only</option>
                        </select>

                        <label htmlFor="line-limit-select" className="form-label" style={{ margin: 0, fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                            Lines:
                        </label>
                        <select
                            id="line-limit-select"
                            className="form-control"
                            style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                            disabled
                            data-testid="console-lines-select"
                        >
                            <option value="100">100 lines</option>
                            <option value="250">250 lines</option>
                            <option value="500">500 lines</option>
                        </select>
                    </div>

                    <div className="actions-group">
                        <button type="button" className="btn btn-secondary btn-sm" disabled data-testid="console-refresh-btn">
                            Refresh
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled data-testid="console-clear-btn">
                            Clear
                        </button>
                    </div>
                </div>

                {/* Dark Terminal Viewer Window */}
                <div
                    data-testid="console-terminal-output"
                    style={{
                        background: '#040711',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        minHeight: '320px',
                        padding: '2rem 1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem'
                    }}
                >
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.6 }}>&gt;_</div>
                        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Console stream is not available until ZeroDactyl is configured
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '400px' }}>
                            No remote log streaming websocket or RCON connection has been initiated.
                        </p>
                    </div>
                </div>

                {/* Command Input Form */}
                <form
                    onSubmit={(e) => e.preventDefault()}
                    data-testid="console-command-form"
                    style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}
                >
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Enter console command (e.g. /say, /whitelist, /op)..."
                        disabled
                        data-testid="console-command-input"
                        style={{ fontFamily: 'monospace' }}
                    />
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled
                        data-testid="console-send-btn"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        Send Command
                    </button>
                </form>
            </div>
        </div>
    );
};
