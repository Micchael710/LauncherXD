import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';

export const TasksPage: React.FC = () => {
    return (
        <div className="tasks-page" data-testid="tasks-page">
            <PageHeader
                title="Scheduled Tasks"
                subtitle="Background automation, periodic updates, and maintenance schedules."
                badge={
                    <span className="badge badge-warning" data-testid="tasks-integration-badge">
                        Waiting for ZeroDactyl integration
                    </span>
                }
            />

            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                ℹ Scheduled tasks automate recurring server operations such as automated restarts, backups, and maintenance broadcasts. The background scheduler will activate when ZeroDactyl is configured.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '1.5rem', alignItems: 'start' }}>
                {/* Left Column: Scheduled Tasks Table */}
                <div>
                    <div className="card" data-testid="tasks-table-card">
                        <div className="card-header">
                            <h2 className="card-title">Scheduled Task List</h2>
                            <span className="badge">0 tasks</span>
                        </div>

                        <div className="table-container" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                            <table className="data-table" data-testid="tasks-table" aria-label="Scheduled Tasks Table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Schedule</th>
                                        <th>Action</th>
                                        <th>Status</th>
                                        <th>Last Run</th>
                                        <th className="cell-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                            <div className="empty-state" data-testid="tasks-empty-state">
                                                <h3 className="empty-state-title" style={{ fontSize: '1rem' }}>No scheduled tasks configured</h3>
                                                <p className="empty-state-description">
                                                    Tasks will be executed automatically by the scheduler daemon according to their cron expressions.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Schedule New Task Card */}
                <div>
                    <div className="card" data-testid="create-task-card">
                        <div className="card-header">
                            <h2 className="card-title">Schedule New Task</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                            Define a recurring automation job using standard cron syntax.
                        </p>

                        <form onSubmit={(e) => e.preventDefault()}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="task-name-input">
                                    Task Name:
                                </label>
                                <input
                                    id="task-name-input"
                                    type="text"
                                    className="form-control"
                                    placeholder="e.g. Daily 4 AM Restart"
                                    disabled
                                    data-testid="task-name-input"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label" htmlFor="task-action-select">
                                    Action to Execute:
                                </label>
                                <select
                                    id="task-action-select"
                                    className="form-control"
                                    defaultValue="restart"
                                    disabled
                                    data-testid="task-action-select"
                                >
                                    <option value="backup">Automated World Backup (backup)</option>
                                    <option value="restart">Server Graceful Restart (restart)</option>
                                    <option value="shutdown">Server Shutdown (shutdown)</option>
                                    <option value="message">Broadcast Server Notice (server message)</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" htmlFor="task-cron-input">
                                    Cron Expression:
                                </label>
                                <input
                                    id="task-cron-input"
                                    type="text"
                                    className="form-control"
                                    placeholder="0 4 * * *"
                                    defaultValue="0 4 * * *"
                                    disabled
                                    data-testid="task-cron-input"
                                    style={{ fontFamily: 'monospace' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                    Standard 5-field cron: minute hour day month weekday (e.g. 0 4 * * * for 04:00 daily).
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled
                                data-testid="create-task-btn"
                            >
                                Schedule Task
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
