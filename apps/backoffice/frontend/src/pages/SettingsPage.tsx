import React, { useState, useEffect, useCallback } from 'react';
import type { SettingItem, UpdateSettingInput } from '../types/settings';
import { SettingsApi } from '../api/settings';
import { formatApiErrorMessage } from '../api/client';
import { SettingsTable } from '../components/SettingsTable';
import { SettingsForm } from '../components/SettingsForm';
import { LocalCredentialsSection } from '../components/LocalCredentialsSection';

export const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<SettingItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [editingSetting, setEditingSetting] = useState<SettingItem | null>(null);

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await SettingsApi.listSettings();
            setSettings(res.value || []);
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err, 'setting'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleFormSubmit = async (key: string, input: UpdateSettingInput) => {
        setIsSubmitting(true);
        setFormError(null);
        try {
            await SettingsApi.upsertSetting(key, input);
            setEditingSetting(null);
            await fetchSettings();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err, 'setting');
            setFormError(msg);
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (item: SettingItem) => {
        setEditingSetting(item);
        setFormError(null);
    };

    const handleCancelEdit = () => {
        setEditingSetting(null);
        setFormError(null);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Settings Management</h1>
                    <p>Configure global application parameters and toggle public/private visibility.</p>
                </div>
            </div>

            <LocalCredentialsSection />

            <div style={{ marginTop: '2rem' }}>
                <SettingsTable
                    settings={settings}
                    isLoading={isLoading}
                    error={error}
                    onEdit={handleEdit}
                />
            </div>

            <SettingsForm
                onSubmit={handleFormSubmit}
                initialData={editingSetting}
                onCancel={handleCancelEdit}
                isSubmitting={isSubmitting}
                errorMessage={formError}
            />
        </div>
    );
};
