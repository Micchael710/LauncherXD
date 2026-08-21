import React, { useState } from 'react';
import type { CreateReleaseInput, ReleaseChannel, ReleaseType } from '../types/releases';

interface Props {
    initialData?: CreateReleaseInput;
    onSubmit: (data: CreateReleaseInput) => Promise<void>;
    submitLabel: string;
    error?: string | null;
}

export const ReleaseForm: React.FC<Props> = ({ initialData, onSubmit, submitLabel, error }) => {
    const [version, setVersion] = useState(initialData?.version || '');
    const [channel, setChannel] = useState<ReleaseChannel>(initialData?.channel || 'stable');
    const [type, setType] = useState<ReleaseType>(initialData?.release_type || 'launcher');
    const [size, setSize] = useState<string>(initialData?.total_size?.toString() || '');
    const [notes, setNotes] = useState(initialData?.release_notes || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit({
                version,
                channel,
                release_type: type,
                total_size: size ? parseInt(size, 10) : undefined,
                release_notes: notes || undefined
            });
        } catch {
            // Handled by parent via error prop
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="form-card" style={{ maxWidth: '480px' }}>
            {error && <div role="alert" className="alert alert-danger">{error}</div>}

            <div className="form-group">
                <label className="form-label">
                    Version:
                    <input
                        required
                        type="text"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="form-control"
                        placeholder="e.g. 1.0.0"
                    />
                </label>
            </div>
            <div className="form-group">
                <label className="form-label">
                    Channel:
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as ReleaseChannel)}
                        className="form-control"
                    >
                        <option value="stable">Stable</option>
                        <option value="beta">Beta</option>
                    </select>
                </label>
            </div>
            <div className="form-group">
                <label className="form-label">
                    Release Type:
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as ReleaseType)}
                        className="form-control"
                    >
                        <option value="launcher">Launcher</option>
                        <option value="modpack">Modpack</option>
                    </select>
                </label>
            </div>
            <div className="form-group">
                <label className="form-label">
                    Total Size (bytes, optional):
                    <input
                        type="number"
                        min="0"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="form-control"
                        placeholder="e.g. 10485760"
                    />
                </label>
            </div>
            <div className="form-group">
                <label className="form-label">
                    Release Notes (optional):
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        className="form-control"
                        placeholder="Changelog and release notes..."
                    />
                </label>
            </div>
            <div className="form-actions">
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                    {isSubmitting ? 'Submitting...' : submitLabel}
                </button>
            </div>
        </form>
    );
};
