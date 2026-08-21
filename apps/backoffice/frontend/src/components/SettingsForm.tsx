import React, { useState, useEffect } from 'react';
import type { SettingItem, UpdateSettingInput } from '../types/settings';
import { isSafeSettingKey } from '../api/client';

export interface SettingsFormProps {
    onSubmit: (key: string, input: UpdateSettingInput) => Promise<void>;
    initialData?: SettingItem | null;
    onCancel?: () => void;
    isSubmitting?: boolean;
    errorMessage?: string | null;
}

export const SettingsForm: React.FC<SettingsFormProps> = ({
    onSubmit,
    initialData = null,
    onCancel,
    isSubmitting = false,
    errorMessage = null
}) => {
    const isEdit = Boolean(initialData);

    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [valueType, setValueType] = useState('string');
    const [isPublic, setIsPublic] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setKey(initialData.key || '');
            setValue(initialData.value || '');
            setValueType(initialData.value_type || 'string');
            setIsPublic(Boolean(initialData.is_public));
            setLocalError(null);
        } else {
            setKey('');
            setValue('');
            setValueType('string');
            setIsPublic(false);
            setLocalError(null);
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        const targetKey = isEdit && initialData ? initialData.key : key.trim();

        if (!targetKey) {
            setLocalError('Key is required.');
            return;
        }

        if (!isSafeSettingKey(targetKey)) {
            setLocalError('Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).');
            return;
        }

        const trimmedValue = value.trim();
        if (!trimmedValue) {
            setLocalError('Value is required.');
            return;
        }

        const trimmedValueType = valueType.trim();
        if (!trimmedValueType) {
            setLocalError('Value type is required.');
            return;
        }

        if (trimmedValueType === 'boolean') {
            if (trimmedValue !== 'true' && trimmedValue !== 'false') {
                setLocalError('Boolean value must be exactly "true" or "false".');
                return;
            }
        } else if (trimmedValueType === 'number') {
            if (isNaN(Number(trimmedValue))) {
                setLocalError('Value must be a valid number.');
                return;
            }
        }

        const input: UpdateSettingInput = {
            value: trimmedValue,
            value_type: trimmedValueType,
            is_public: isPublic
        };

        try {
            await onSubmit(targetKey, input);
            if (!isEdit) {
                setKey('');
                setValue('');
                setValueType('string');
                setIsPublic(false);
                setLocalError(null);
            }
        } catch {
            // Parent handles API error display
        }
    };

    const displayError = localError || errorMessage;
    const formHeading = isEdit && initialData ? `Edit Setting: ${initialData.key}` : 'Create Setting';
    const submitLabel = isSubmitting ? 'Saving...' : (isEdit ? 'Save Setting' : 'Create Setting');

    return (
        <form onSubmit={handleSubmit} className="form-card" aria-label={formHeading} style={{ maxWidth: '640px' }}>
            <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
                <h3 className="card-title">{formHeading}</h3>
            </div>

            {displayError && (
                <div role="alert" className="alert alert-danger">
                    {displayError}
                </div>
            )}

            <div className="form-group">
                <label htmlFor="setting-key" className="form-label">Key:</label>
                <input
                    id="setting-key"
                    type="text"
                    value={isEdit && initialData ? initialData.key : key}
                    onChange={(e) => setKey(e.target.value)}
                    disabled={isEdit || isSubmitting}
                    className="form-control"
                    placeholder="e.g. launcher_name"
                />
            </div>

            <div className="form-group">
                <label htmlFor="setting-value" className="form-label">Value:</label>
                <textarea
                    id="setting-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    style={{ minHeight: '60px' }}
                    placeholder="Setting value"
                />
            </div>

            <div className="form-group">
                <label htmlFor="setting-value-type" className="form-label">Value Type:</label>
                <input
                    id="setting-value-type"
                    type="text"
                    value={valueType}
                    onChange={(e) => setValueType(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    placeholder="string, boolean, number, etc."
                />
            </div>

            <div className="form-group">
                <label htmlFor="setting-is-public" className="form-checkbox-label">
                    <input
                        id="setting-is-public"
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        disabled={isSubmitting}
                    />
                    <span>Public setting (accessible without admin credentials)</span>
                </label>
            </div>

            <div className="form-actions">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                >
                    {submitLabel}
                </button>
                {isEdit && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};
