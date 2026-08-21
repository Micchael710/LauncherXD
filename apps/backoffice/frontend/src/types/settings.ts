export interface SettingItem {
    key: string;
    value: string;
    value_type: string;
    is_public: boolean;
    updated_at: string;
}

export interface RawSettingItem {
    key: string;
    value: string;
    value_type: string;
    is_public: boolean | 0 | 1;
    updated_at: string;
}

export interface ListSettingsResponse {
    value: RawSettingItem[];
    Count: number;
}

export interface UpdateSettingInput {
    value: string;
    value_type: string;
    is_public?: boolean;
}

export interface SettingActionResponse {
    status: 'ok';
}

export function normalizeSettingItem(item: RawSettingItem): SettingItem {
    return {
        ...item,
        is_public: item.is_public === true || item.is_public === 1
    };
}
