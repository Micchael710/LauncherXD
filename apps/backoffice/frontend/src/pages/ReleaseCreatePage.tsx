import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatApiErrorMessage } from '../api/client';
import { ReleasesApi } from '../api/releases';
import { ReleaseForm } from '../components/ReleaseForm';
import type { CreateReleaseInput } from '../types/releases';

export const ReleaseCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (data: CreateReleaseInput) => {
        try {
            const res = await ReleasesApi.createRelease(data);
            navigate(`/releases/${res.id}`);
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err);
            setError(msg);
            throw err;
        }
    };

    return (
        <div>
            <h1>Create Draft Release</h1>
            <ReleaseForm onSubmit={handleSubmit} submitLabel="Create Draft" error={error} />
        </div>
    );
};
