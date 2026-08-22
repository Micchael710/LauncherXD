import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SettingsPage } from '../pages/SettingsPage';
import { SettingsApi } from '../api/settings';
import { CredentialsApi } from '../api/credentials';
import { ApiClientError } from '../api/client';
import type { SettingItem, SettingActionResponse } from '../types/settings';

describe('Settings UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(CredentialsApi, 'getStatus').mockResolvedValue({
            admin: { configured: false },
            github: { configured: false }
        });
    });

    const mockSettingsList: SettingItem[] = [
        {
            key: 'launcher_name',
            value: 'LauncherXD',
            value_type: 'string',
            is_public: true,
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            key: 'maintenance_mode',
            value: 'false',
            value_type: 'boolean',
            is_public: false,
            updated_at: '2026-08-20T11:00:00Z'
        },
        {
            key: 'max_memory_mb',
            value: '4096',
            value_type: 'number',
            is_public: true,
            updated_at: '2026-08-20T12:00:00Z'
        }
    ];

    test('1. Shows loading state while request is pending', async () => {
        vi.spyOn(SettingsApi, 'listSettings').mockImplementation(() => new Promise(() => {}));

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByTestId('settings-loading')).toBeDefined();
        expect(screen.getByText('Loading settings...')).toBeDefined();

        // Wait for credentials status fetch to settle cleanly without background act() warning
        await waitFor(() => {
            expect(screen.getByTestId('credential-card-admin')).toBeDefined();
        });
    });

    test('2. Displays empty state when settings list is empty', async () => {
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: [], Count: 0 });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('settings-empty')).toBeDefined();
            expect(screen.getByText('No settings found.')).toBeDefined();
        });
    });

    test('3. Renders settings table with Public and Private badges and no Delete button', async () => {
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettingsList, Count: 3 });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('launcher_name')).toBeDefined();
            expect(screen.getByText('LauncherXD')).toBeDefined();
            expect(screen.getByText('maintenance_mode')).toBeDefined();
            expect(screen.getByText('max_memory_mb')).toBeDefined();
            expect(screen.getAllByText('Public').length).toBe(2);
            expect(screen.getByText('Private')).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit launcher_name' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit maintenance_mode' })).toBeDefined();
            expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
        });
    });

    test('4. Creates new setting with exact PUT payload and reloads table', async () => {
        const user = userEvent.setup();
        const updatedList: SettingItem[] = [
            ...mockSettingsList,
            {
                key: 'theme_color',
                value: 'dark_blue',
                value_type: 'string',
                is_public: true,
                updated_at: '2026-08-20T13:00:00Z'
            }
        ];

        const listSpy = vi.spyOn(SettingsApi, 'listSettings')
            .mockResolvedValueOnce({ value: mockSettingsList, Count: 3 })
            .mockResolvedValueOnce({ value: updatedList, Count: 4 });

        const upsertSpy = vi.spyOn(SettingsApi, 'upsertSetting').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
        });

        const keyInput = screen.getByLabelText(/^Key:/i);
        const valueInput = screen.getByLabelText(/^Value:/i);
        const valueTypeInput = screen.getByLabelText(/^Value Type:/i);
        const isPublicCheckbox = screen.getByLabelText(/Public setting/i);
        const submitBtn = screen.getByRole('button', { name: 'Create Setting' });

        await user.type(keyInput, 'theme_color');
        await user.type(valueInput, 'dark_blue');
        await user.clear(valueTypeInput);
        await user.type(valueTypeInput, 'string');
        await user.click(isPublicCheckbox);

        await user.click(submitBtn);

        expect(upsertSpy).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledWith('theme_color', {
            value: 'dark_blue',
            value_type: 'string',
            is_public: true
        });

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByText('theme_color')).toBeDefined();
            expect(screen.getByText('dark_blue')).toBeDefined();
        });
    });

    test('5. Edit preloads data from row, disables key input without GET, sends full PUT payload, and reloads list', async () => {
        const user = userEvent.setup();
        const updatedList: SettingItem[] = [
            {
                ...mockSettingsList[0],
                value: 'LauncherXD Remastered'
            },
            mockSettingsList[1],
            mockSettingsList[2]
        ];

        const listSpy = vi.spyOn(SettingsApi, 'listSettings')
            .mockResolvedValueOnce({ value: mockSettingsList, Count: 3 })
            .mockResolvedValueOnce({ value: updatedList, Count: 3 });

        const upsertSpy = vi.spyOn(SettingsApi, 'upsertSetting').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher_name' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher_name' }));

        expect(screen.getByRole('heading', { name: 'Edit Setting: launcher_name' })).toBeDefined();
        const keyInput = screen.getByLabelText(/^Key:/i) as HTMLInputElement;
        const valueInput = screen.getByLabelText(/^Value:/i) as HTMLTextAreaElement;
        const valueTypeInput = screen.getByLabelText(/^Value Type:/i) as HTMLInputElement;
        const isPublicCheckbox = screen.getByLabelText(/Public setting/i) as HTMLInputElement;

        expect(keyInput.value).toBe('launcher_name');
        expect(keyInput.hasAttribute('disabled')).toBe(true);
        expect(valueInput.value).toBe('LauncherXD');
        expect(valueTypeInput.value).toBe('string');
        expect(isPublicCheckbox.checked).toBe(true);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();

        await user.clear(valueInput);
        await user.type(valueInput, 'LauncherXD Remastered');

        const saveBtn = screen.getByRole('button', { name: 'Save Setting' });
        await user.click(saveBtn);

        expect(upsertSpy).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledWith('launcher_name', {
            value: 'LauncherXD Remastered',
            value_type: 'string',
            is_public: true
        });

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
            expect(screen.getByText('LauncherXD Remastered')).toBeDefined();
        });
    });

    test('6. Cancel in Edit mode closes form and does NOT call API', async () => {
        const user = userEvent.setup();
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValue({ value: mockSettingsList, Count: 3 });
        const upsertSpy = vi.spyOn(SettingsApi, 'upsertSetting');

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher_name' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher_name' }));
        expect(screen.getByRole('heading', { name: 'Edit Setting: launcher_name' })).toBeDefined();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(upsertSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
    });

    test('7. Validations: empty key and unsafe keys in lowercase, uppercase, and substring', async () => {
        const user = userEvent.setup();
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: [], Count: 0 });
        const upsertSpy = vi.spyOn(SettingsApi, 'upsertSetting');

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
        });

        const keyInput = screen.getByLabelText(/^Key:/i);
        const valueInput = screen.getByLabelText(/^Value:/i);
        const submitBtn = screen.getByRole('button', { name: 'Create Setting' });

        // 1. Empty key
        await user.type(valueInput, 'some_value');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Key is required.')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();

        // 2. Unsafe key: cloudflare_access_
        await user.type(keyInput, 'CLOUDFLARE_ACCESS_CLIENT_ID');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();

        // 3. Unsafe key: github_
        await user.clear(keyInput);
        await user.type(keyInput, 'github_oauth_secret');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();

        // 4. Unsafe key: substring 'password'
        await user.clear(keyInput);
        await user.type(keyInput, 'admin_password_hash');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();
    });

    test('8. Validations: empty value, empty value_type, invalid boolean and invalid number', async () => {
        const user = userEvent.setup();
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: [], Count: 0 });
        const upsertSpy = vi.spyOn(SettingsApi, 'upsertSetting');

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
        });

        const keyInput = screen.getByLabelText(/^Key:/i);
        const valueInput = screen.getByLabelText(/^Value:/i);
        const valueTypeInput = screen.getByLabelText(/^Value Type:/i);
        const submitBtn = screen.getByRole('button', { name: 'Create Setting' });

        await user.type(keyInput, 'my_setting');

        // 1. Empty value
        await user.click(submitBtn);
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Value is required.')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();

        // 2. Empty value_type
        await user.type(valueInput, 'test_val');
        await user.clear(valueTypeInput);
        await user.click(submitBtn);
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Value type is required.')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();

        // 3. Invalid boolean
        await user.clear(valueTypeInput);
        await user.type(valueTypeInput, 'boolean');
        await user.clear(valueInput);
        await user.type(valueInput, 'yes');
        await user.click(submitBtn);
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Boolean value must be exactly "true" or "false".')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();

        // 4. Invalid number
        await user.clear(valueTypeInput);
        await user.type(valueTypeInput, 'number');
        await user.clear(valueInput);
        await user.type(valueInput, 'not_a_number');
        await user.click(submitBtn);
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Value must be a valid number.')).toBeDefined();
        expect(upsertSpy).not.toHaveBeenCalled();
    });

    test('9. Allows unknown custom non-empty value_type', async () => {
        const user = userEvent.setup();
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValue({ value: [], Count: 0 });
        const upsertSpy = vi.spyOn(SettingsApi, 'upsertSetting').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
        });

        const keyInput = screen.getByLabelText(/^Key:/i);
        const valueInput = screen.getByLabelText(/^Value:/i);
        const valueTypeInput = screen.getByLabelText(/^Value Type:/i);
        const submitBtn = screen.getByRole('button', { name: 'Create Setting' });

        await user.type(keyInput, 'server_custom_config');
        await user.type(valueInput, 'custom_config_value_123');
        await user.clear(valueTypeInput);
        await user.type(valueTypeInput, 'custom_type');

        await user.click(submitBtn);

        expect(upsertSpy).toHaveBeenCalledTimes(1);
        expect(upsertSpy).toHaveBeenCalledWith('server_custom_config', {
            value: 'custom_config_value_123',
            value_type: 'custom_type',
            is_public: false
        });
    });

    test('10. Pending PUT shows Saving... and disables all controls and buttons', async () => {
        const user = userEvent.setup();
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValue({ value: mockSettingsList, Count: 3 });

        let resolvePut: ((res: SettingActionResponse) => void) | undefined;
        vi.spyOn(SettingsApi, 'upsertSetting').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolvePut = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher_name' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher_name' }));

        const keyInput = screen.getByLabelText(/^Key:/i);
        const valueInput = screen.getByLabelText(/^Value:/i);
        const valueTypeInput = screen.getByLabelText(/^Value Type:/i);
        const isPublicCheckbox = screen.getByLabelText(/Public setting/i);
        const saveBtn = screen.getByRole('button', { name: 'Save Setting' });
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });

        await user.clear(valueInput);
        await user.type(valueInput, 'Updated In Flight');
        await user.click(saveBtn);

        expect(saveBtn.textContent).toBe('Saving...');
        expect(saveBtn.hasAttribute('disabled')).toBe(true);
        expect(cancelBtn.hasAttribute('disabled')).toBe(true);
        expect(keyInput.hasAttribute('disabled')).toBe(true);
        expect(valueInput.hasAttribute('disabled')).toBe(true);
        expect(valueTypeInput.hasAttribute('disabled')).toBe(true);
        expect(isPublicCheckbox.hasAttribute('disabled')).toBe(true);

        resolvePut?.({ status: 'ok' });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
        });
    });

    test('11. Displays visible error banner on failed PUT without window.alert', async () => {
        const user = userEvent.setup();
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(SettingsApi, 'upsertSetting').mockRejectedValueOnce(
            new ApiClientError(400, 'validation_error', ['invalid_or_unsafe_key'])
        );
        const alertSpy = vi.spyOn(window, 'alert');

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create Setting' })).toBeDefined();
        });

        const keyInput = screen.getByLabelText(/^Key:/i);
        const valueInput = screen.getByLabelText(/^Value:/i);
        const submitBtn = screen.getByRole('button', { name: 'Create Setting' });

        await user.type(keyInput, 'valid_local_key');
        await user.type(valueInput, 'val');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Validation error: Invalid or unsafe setting key (must be non-empty and cannot contain sensitive names).')).toBeDefined();
            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    test('12. Displays authentication error when list request fails with 401', async () => {
        vi.spyOn(SettingsApi, 'listSettings').mockRejectedValueOnce(
            new ApiClientError(401, 'ADMIN_AUTH_NOT_CONFIGURED')
        );

        render(
            <MemoryRouter initialEntries={['/settings']}>
                <Routes>
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Admin authentication is not configured.')).toBeDefined();
        });
    });
});
