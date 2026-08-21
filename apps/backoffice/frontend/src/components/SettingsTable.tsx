import React from 'react';
import type { SettingItem } from '../types/settings';

export interface SettingsTableProps {
    settings: SettingItem[];
    isLoading: boolean;
    error: string | null;
    onEdit?: (item: SettingItem) => void;
}

export const SettingsTable: React.FC<SettingsTableProps> = ({
    settings,
    isLoading,
    error,
    onEdit
}) => {
    if (isLoading) {
        return <div data-testid="settings-loading" className="state-loading">Loading settings...</div>;
    }

    return (
        <div style={{ marginTop: '1rem' }}>
            {error && (
                <div role="alert" className="alert alert-danger">
                    {error}
                </div>
            )}

            {settings.length === 0 ? (
                <div data-testid="settings-empty" className="state-empty">No settings found.</div>
            ) : (
                <div className="table-container">
                    <table className="data-table" aria-label="Settings Table">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                                <th>Value Type</th>
                                <th>Visibility</th>
                                <th>Last Updated</th>
                                <th className="cell-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settings.map((item) => (
                                <tr key={item.key}>
                                    <td style={{ fontWeight: 600 }}>{item.key}</td>
                                    <td style={{ fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '300px' }}>{item.value}</td>
                                    <td><span className="badge badge-stable">{item.value_type}</span></td>
                                    <td>
                                        <span className={item.is_public ? 'badge badge-public' : 'badge badge-private'}>
                                            {item.is_public ? 'Public' : 'Private'}
                                        </span>
                                    </td>
                                    <td>
                                        {item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}
                                    </td>
                                    <td className="cell-actions">
                                        {onEdit && (
                                            <button
                                                type="button"
                                                onClick={() => onEdit(item)}
                                                aria-label={`Edit ${item.key}`}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
