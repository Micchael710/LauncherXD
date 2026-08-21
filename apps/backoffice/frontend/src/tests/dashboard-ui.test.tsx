import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { ReleasesApi } from '../api/releases';
import { NewsApi } from '../api/news';
import { SettingsApi } from '../api/settings';
import { ApiClientError } from '../api/client';
import type { Release } from '../types/releases';
import type { NewsItem } from '../types/news';
import type { SettingItem } from '../types/settings';

describe('Dashboard UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockReleases: Release[] = [
        {
            id: 'rel-1',
            version: '1.0.0',
            channel: 'stable',
            release_type: 'launcher',
            status: 'published',
            release_notes: 'Initial release',
            total_size: 1000,
            created_at: '2026-08-20T09:00:00Z',
            updated_at: '2026-08-20T09:00:00Z'
        },
        {
            id: 'rel-2',
            version: '1.1.0-beta.1',
            channel: 'beta',
            release_type: 'launcher',
            status: 'draft',
            release_notes: 'Beta draft',
            total_size: 0,
            created_at: '2026-08-20T10:00:00Z',
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            id: 'rel-3',
            version: '0.9.0',
            channel: 'stable',
            release_type: 'launcher',
            status: 'deprecated',
            release_notes: 'Old deprecated version',
            total_size: 500,
            created_at: '2026-08-10T09:00:00Z',
            updated_at: '2026-08-10T09:00:00Z'
        },
        {
            id: 'rel-4',
            version: '1.2.0-beta.1',
            channel: 'beta',
            release_type: 'launcher',
            status: 'draft',
            release_notes: 'Second draft',
            total_size: 0,
            created_at: '2026-08-20T11:00:00Z',
            updated_at: '2026-08-20T11:00:00Z'
        }
    ];

    const mockNews: NewsItem[] = [
        {
            id: 'news-1',
            title: 'Welcome to LauncherXD',
            summary: 'Public announcement',
            image_url: null,
            target_url: null,
            published: true,
            published_at: '2026-08-20T10:00:00Z',
            created_at: '2026-08-20T10:00:00Z',
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            id: 'news-2',
            title: 'Upcoming Server Event',
            summary: 'Event details',
            image_url: null,
            target_url: null,
            published: true,
            published_at: '2026-08-20T11:00:00Z',
            created_at: '2026-08-20T11:00:00Z',
            updated_at: '2026-08-20T11:00:00Z'
        },
        {
            id: 'news-3',
            title: 'Draft Maintenance News',
            summary: 'Draft details',
            image_url: null,
            target_url: null,
            published: false,
            published_at: null,
            created_at: '2026-08-20T12:00:00Z',
            updated_at: '2026-08-20T12:00:00Z'
        }
    ];

    const mockSettings: SettingItem[] = [
        {
            key: 'launcher_name',
            value: 'LauncherXD Official',
            value_type: 'string',
            is_public: true,
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            key: 'theme_color',
            value: 'dark',
            value_type: 'string',
            is_public: true,
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            key: 'max_memory_mb',
            value: '4096',
            value_type: 'number',
            is_public: true,
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            key: 'internal_admin_flag',
            value: 'active_secret_data',
            value_type: 'string',
            is_public: false,
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            key: 'private_metric_config',
            value: 'private_value_payload',
            value_type: 'string',
            is_public: false,
            updated_at: '2026-08-20T10:00:00Z'
        }
    ];

    test('1. Shows Loading dashboard... while the three promises are pending', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockImplementation(() => new Promise(() => {}));
        vi.spyOn(NewsApi, 'listNews').mockImplementation(() => new Promise(() => {}));
        vi.spyOn(SettingsApi, 'listSettings').mockImplementation(() => new Promise(() => {}));

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByTestId('dashboard-loading')).toBeDefined();
        expect(screen.getByText('Loading dashboard...')).toBeDefined();
    });

    test('2. Calls each of the three read clients exactly once during initial mount', async () => {
        const releasesSpy = vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        const newsSpy = vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        const settingsSpy = vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined();
        });

        expect(releasesSpy).toHaveBeenCalledTimes(1);
        expect(newsSpy).toHaveBeenCalledTimes(1);
        expect(settingsSpy).toHaveBeenCalledTimes(1);
    });

    test('3. Renders all counts for Releases correctly', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('card-releases')).toBeDefined();
        });

        const releasesCard = screen.getByTestId('card-releases');
        expect(releasesCard.textContent).toContain('4 Total');
        expect(releasesCard.textContent).toContain('Draft: 2');
        expect(releasesCard.textContent).toContain('Published: 1');
        expect(releasesCard.textContent).toContain('Deprecated: 1');
    });

    test('4. Renders all counts for News correctly', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('card-news')).toBeDefined();
        });

        const newsCard = screen.getByTestId('card-news');
        expect(newsCard.textContent).toContain('3 Total');
        expect(newsCard.textContent).toContain('Published: 2');
        expect(newsCard.textContent).toContain('Draft: 1');
    });

    test('5. Renders all counts for Settings correctly', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('card-settings')).toBeDefined();
        });

        const settingsCard = screen.getByTestId('card-settings');
        expect(settingsCard.textContent).toContain('5 Total');
        expect(settingsCard.textContent).toContain('Public: 3');
        expect(settingsCard.textContent).toContain('Private: 2');
    });

    test('6. Empty lists display zero across all counts', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: [], Count: 0 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('card-releases')).toBeDefined();
        });

        const releasesCard = screen.getByTestId('card-releases');
        expect(releasesCard.textContent).toContain('0 Total');
        expect(releasesCard.textContent).toContain('Draft: 0');
        expect(releasesCard.textContent).toContain('Published: 0');
        expect(releasesCard.textContent).toContain('Deprecated: 0');

        const newsCard = screen.getByTestId('card-news');
        expect(newsCard.textContent).toContain('0 Total');
        expect(newsCard.textContent).toContain('Published: 0');
        expect(newsCard.textContent).toContain('Draft: 0');

        const settingsCard = screen.getByTestId('card-settings');
        expect(settingsCard.textContent).toContain('0 Total');
        expect(settingsCard.textContent).toContain('Public: 0');
        expect(settingsCard.textContent).toContain('Private: 0');
    });

    test('7. No individual keys or values of Settings are displayed anywhere', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('card-settings')).toBeDefined();
        });

        // Ensure sensitive / individual setting keys and values are NOT rendered
        expect(screen.queryByText('launcher_name')).toBeNull();
        expect(screen.queryByText('LauncherXD Official')).toBeNull();
        expect(screen.queryByText('internal_admin_flag')).toBeNull();
        expect(screen.queryByText('active_secret_data')).toBeNull();
        expect(screen.queryByText('private_metric_config')).toBeNull();
        expect(screen.queryByText('private_value_payload')).toBeNull();
    });

    test('8. Handles ADMIN_AUTH_NOT_CONFIGURED error with visible alert banner and hides stats', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockRejectedValueOnce(
            new ApiClientError(401, 'ADMIN_AUTH_NOT_CONFIGURED')
        );
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Admin authentication is not configured.')).toBeDefined();
        });

        expect(screen.queryByTestId('card-releases')).toBeNull();
        expect(screen.queryByTestId('card-news')).toBeNull();
        expect(screen.queryByTestId('card-settings')).toBeNull();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });

    test('9. Handles ADMIN_UNAUTHORIZED error with visible alert banner and hides stats', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockRejectedValueOnce(
            new ApiClientError(401, 'ADMIN_UNAUTHORIZED')
        );
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Admin unauthorized (invalid or missing credentials).')).toBeDefined();
        });

        expect(screen.queryByTestId('card-releases')).toBeNull();
        expect(screen.queryByTestId('card-news')).toBeNull();
        expect(screen.queryByTestId('card-settings')).toBeNull();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });

    test('10. Handles generic network error with visible alert banner and hides stats', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockRejectedValueOnce(new Error('Network offline'));

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Network offline')).toBeDefined();
        });

        expect(screen.queryByTestId('card-releases')).toBeNull();
        expect(screen.queryByTestId('card-news')).toBeNull();
        expect(screen.queryByTestId('card-settings')).toBeNull();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });

    test('11. Retry button re-executes all three queries after an error', async () => {
        const user = userEvent.setup();
        const releasesSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockRejectedValueOnce(new ApiClientError(500, 'server_error'))
            .mockResolvedValueOnce({ value: mockReleases, Count: 4 });

        const newsSpy = vi.spyOn(NewsApi, 'listNews')
            .mockResolvedValueOnce({ value: mockNews, Count: 3 })
            .mockResolvedValueOnce({ value: mockNews, Count: 3 });

        const settingsSpy = vi.spyOn(SettingsApi, 'listSettings')
            .mockResolvedValueOnce({ value: mockSettings, Count: 5 })
            .mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(screen.getByTestId('card-releases')).toBeDefined();
        });

        expect(releasesSpy).toHaveBeenCalledTimes(2);
        expect(newsSpy).toHaveBeenCalledTimes(2);
        expect(settingsSpy).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    test('12. Refresh button re-fetches all data and updates counts', async () => {
        const user = userEvent.setup();
        const updatedReleases: Release[] = [
            ...mockReleases,
            {
                id: 'rel-5',
                version: '2.0.0',
                channel: 'stable',
                release_type: 'launcher',
                status: 'published',
                release_notes: 'Major 2.0 release',
                total_size: 2000,
                created_at: '2026-08-20T12:00:00Z',
                updated_at: '2026-08-20T12:00:00Z'
            }
        ];

        const releasesSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockResolvedValueOnce({ value: mockReleases, Count: 4 })
            .mockResolvedValueOnce({ value: updatedReleases, Count: 5 });

        const newsSpy = vi.spyOn(NewsApi, 'listNews')
            .mockResolvedValueOnce({ value: mockNews, Count: 3 })
            .mockResolvedValueOnce({ value: mockNews, Count: 3 });

        const settingsSpy = vi.spyOn(SettingsApi, 'listSettings')
            .mockResolvedValueOnce({ value: mockSettings, Count: 5 })
            .mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('card-releases')).toBeDefined();
            expect(screen.getByTestId('card-releases').textContent).toContain('4 Total');
        });

        const refreshBtn = screen.getByRole('button', { name: 'Refresh' });
        await user.click(refreshBtn);

        await waitFor(() => {
            expect(releasesSpy).toHaveBeenCalledTimes(2);
            expect(newsSpy).toHaveBeenCalledTimes(2);
            expect(settingsSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByTestId('card-releases').textContent).toContain('5 Total');
            expect(screen.getByTestId('card-releases').textContent).toContain('Published: 2');
        });
    });

    test('13. During Refresh, the button is disabled and displays Refreshing...', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNews, Count: 3 });

        let resolveSettings: ((val: { value: SettingItem[]; Count: number }) => void) | undefined;
        vi.spyOn(SettingsApi, 'listSettings')
            .mockResolvedValueOnce({ value: mockSettings, Count: 5 })
            .mockImplementationOnce(() => {
                return new Promise((resolve) => {
                    resolveSettings = resolve;
                });
            });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
        });

        const refreshBtn = screen.getByRole('button', { name: 'Refresh' });
        await user.click(refreshBtn);

        expect(refreshBtn.textContent).toBe('Refreshing...');
        expect(refreshBtn.hasAttribute('disabled')).toBe(true);

        resolveSettings?.({ value: mockSettings, Count: 5 });

        await waitFor(() => {
            expect(refreshBtn.textContent).toBe('Refresh');
            expect(refreshBtn.hasAttribute('disabled')).toBe(false);
        });
    });

    test('14. The three navigation links have exact valid to destinations', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined();
        });

        const releasesLink = screen.getByRole('link', { name: 'Manage Releases' });
        expect(releasesLink.getAttribute('href')).toBe('/releases');

        const newsLink = screen.getByRole('link', { name: 'Manage News' });
        expect(newsLink.getAttribute('href')).toBe('/news');

        const settingsLink = screen.getByRole('link', { name: 'Manage Settings' });
        expect(settingsLink.getAttribute('href')).toBe('/settings');
    });

    test('15. No creation, update, or deletion APIs are called at all', async () => {
        const createRelSpy = vi.spyOn(ReleasesApi, 'createRelease');
        const updateRelSpy = vi.spyOn(ReleasesApi, 'updateRelease');
        const deleteRelSpy = vi.spyOn(ReleasesApi, 'deleteRelease');
        const createNewsSpy = vi.spyOn(NewsApi, 'createNews');
        const updateNewsSpy = vi.spyOn(NewsApi, 'updateNews');
        const deleteNewsSpy = vi.spyOn(NewsApi, 'deleteNews');
        const upsertSettingSpy = vi.spyOn(SettingsApi, 'upsertSetting');

        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: mockReleases, Count: 4 });
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNews, Count: 3 });
        vi.spyOn(SettingsApi, 'listSettings').mockResolvedValueOnce({ value: mockSettings, Count: 5 });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeDefined();
        });

        expect(createRelSpy).not.toHaveBeenCalled();
        expect(updateRelSpy).not.toHaveBeenCalled();
        expect(deleteRelSpy).not.toHaveBeenCalled();
        expect(createNewsSpy).not.toHaveBeenCalled();
        expect(updateNewsSpy).not.toHaveBeenCalled();
        expect(deleteNewsSpy).not.toHaveBeenCalled();
        expect(upsertSettingSpy).not.toHaveBeenCalled();
    });
});
