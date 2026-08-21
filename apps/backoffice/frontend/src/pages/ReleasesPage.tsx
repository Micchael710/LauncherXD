import React, { useEffect, useState } from 'react';
import type { Release } from '../types/releases';
import { formatApiErrorMessage } from '../api/client';
import { ReleasesApi } from '../api/releases';
import { ReleaseTable } from '../components/ReleaseTable';
import { Link } from 'react-router-dom';

export const ReleasesPage: React.FC = () => {
    const [releases, setReleases] = useState<Release[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        ReleasesApi.listReleases()
            .then((res) => {
                setReleases(res.value || []);
                setError(null);
            })
            .catch((err: unknown) => setError(formatApiErrorMessage(err)))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Releases</h1>
                    <p>Manage and distribute LauncherXD application and modpack versions.</p>
                </div>
                <Link to="/releases/new" className="btn btn-primary">
                    + New Release
                </Link>
            </div>
            <ReleaseTable releases={releases} isLoading={isLoading} error={error} />
        </div>
    );
};
