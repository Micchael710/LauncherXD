import { LocalApiClient } from './client';
import {
    type SettingItem,
    type ListSettingsResponse,
    type UpdateSettingInput,
    type SettingActionResponse,
    normalizeSettingItem
} from '../types/settings';

export const SettingsApi = {
    async listSettings(): Promise<{ value: SettingItem[]; Count: number }> {
        const res = await LocalApiClient.fetch<ListSettingsResponse>('/api/admin/settings');
        return {
            value: (res.value || []).map(normalizeSettingItem),
            Count: res.Count ?? (res.value?.length || 0)
        };
    },

    async upsertSetting(key: string, input: UpdateSettingInput): Promise<SettingActionResponse> {
        const payload: UpdateSettingInput = {
            value: input.value,
            value_type: input.value_type
        };
        if (input.is_public !== undefined) {
            payload.is_public = input.is_public;
        }

        const encodedKey = encodeURIComponent(key);
        return LocalApiClient.fetch<SettingActionResponse>(`/api/admin/settings/${encodedKey}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
