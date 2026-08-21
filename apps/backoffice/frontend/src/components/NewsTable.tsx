import React from 'react';
import type { NewsItem } from '../types/news';

export interface NewsTableProps {
    news: NewsItem[];
    isLoading: boolean;
    error: string | null;
    onEdit?: (item: NewsItem) => void;
    onDelete?: (id: string) => Promise<void>;
    deletingNewsId?: string | null;
}

export const NewsTable: React.FC<NewsTableProps> = ({
    news,
    isLoading,
    error,
    onEdit,
    onDelete,
    deletingNewsId = null
}) => {
    if (isLoading) {
        return <div data-testid="news-loading" className="state-loading">Loading news...</div>;
    }

    const handleDeleteClick = async (item: NewsItem) => {
        if (!onDelete) return;
        const confirmed = window.confirm(`Are you sure you want to delete news "${item.title}"?`);
        if (confirmed) {
            await onDelete(item.id);
        }
    };

    return (
        <div style={{ marginTop: '1rem' }}>
            {error && (
                <div role="alert" className="alert alert-danger">
                    {error}
                </div>
            )}

            {news.length === 0 ? (
                <div data-testid="news-empty" className="state-empty">No news found.</div>
            ) : (
                <div className="table-container">
                    <table className="data-table" aria-label="News Table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Summary</th>
                                <th>Status</th>
                                <th>Image URL</th>
                                <th>Target URL</th>
                                <th>Published Date</th>
                                <th>Created Date</th>
                                <th className="cell-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {news.map((item) => {
                                const isDeleting = deletingNewsId === item.id;
                                return (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 600 }}>{item.title}</td>
                                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.summary || '-'}
                                        </td>
                                        <td>
                                            <span className={item.published ? 'badge badge-published' : 'badge badge-draft'}>
                                                {item.published ? 'Published' : 'Draft'}
                                            </span>
                                        </td>
                                        <td>
                                            {item.image_url ? (
                                                <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                                    View Image
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            {item.target_url ? (
                                                <a href={item.target_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                                                    Open Link
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            {item.published_at ? new Date(item.published_at).toLocaleString() : '-'}
                                        </td>
                                        <td>
                                            {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="cell-actions">
                                            <div className="actions-group">
                                                {onEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onEdit(item)}
                                                        disabled={isDeleting}
                                                        aria-label={`Edit ${item.title}`}
                                                        className="btn btn-secondary btn-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClick(item)}
                                                        disabled={isDeleting}
                                                        aria-label={`Delete ${item.title}`}
                                                        className="btn btn-danger btn-sm"
                                                    >
                                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
