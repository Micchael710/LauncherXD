import React from 'react';
import type { Release } from '../types/releases';
import { Link } from 'react-router-dom';

interface Props {
    releases: Release[];
    isLoading: boolean;
    error: string | null;
}

export const ReleaseTable: React.FC<Props> = ({ releases, isLoading, error }) => {
    if (isLoading) return <div className="state-loading">Loading releases...</div>;
    if (error) return <div role="alert" className="alert alert-danger">{error}</div>;
    if (releases.length === 0) return <div className="state-empty">No releases found.</div>;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'published': return 'badge badge-published';
            case 'draft': return 'badge badge-draft';
            case 'deprecated': return 'badge badge-deprecated';
            default: return 'badge';
        }
    };

    const getChannelBadge = (channel: string) => {
        return channel === 'stable' ? 'badge badge-stable' : 'badge badge-beta';
    };

    const getTypeBadge = (type: string) => {
        return type === 'launcher' ? 'badge badge-launcher' : 'badge badge-modpack';
    };

    return (
        <div className="table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Version</th>
                        <th>Type</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th className="cell-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {releases.map((r) => (
                        <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>{r.version}</td>
                            <td><span className={getTypeBadge(r.release_type)}>{r.release_type}</span></td>
                            <td><span className={getChannelBadge(r.channel)}>{r.channel}</span></td>
                            <td><span className={getStatusBadge(r.status)}>{r.status}</span></td>
                            <td className="cell-actions">
                                <Link to={`/releases/${r.id}`} className="btn btn-secondary btn-sm">
                                    View Details
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
