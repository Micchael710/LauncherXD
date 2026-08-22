import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ModpackPage } from '../pages/ModpackPage';
import { ReleasesApi } from '../api/releases';
import { ApiClientError } from '../api/client';
import type { Release, CreateReleaseInput } from '../types/releases';

describe('Modpack Manager UI Functional Tests (Module 3A)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockModpackDraft: Release = {
        id: 'modpack-draft-1',
        version: '1.0.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'draft',
        total_size: 1048576,
        release_notes: 'Initial modpack draft release',
        created_at: '2026-08-21T00:00:00Z',
        updated_at: '2026-08-21T10:00:00Z'
    };

    const mockModpackPublished: Release = {
        id: 'modpack-pub-1',
        version: '0.9.0',
        channel: 'beta',
        release_type: 'modpack',
        status: 'published',
        total_size: 2048576,
        release_notes: '',
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T12:00:00Z'
    };

    const mockModpackDeprecated: Release = {
        id: 'modpack-dep-1',
        version: '0.5.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'deprecated',
        total_size: 512000,
        release_notes: 'Old deprecated version',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T08:00:00Z'
    };

    const mockLauncherRelease: Release = {
        id: 'launcher-rel-1',
        version: '2.0.0',
        channel: 'stable',
        release_type: 'launcher',
        status: 'published',
        total_size: 15728640,
        release_notes: 'Launcher update',
        created_at: '2026-08-10T00:00:00Z',
        updated_at: '2026-08-10T00:00:00Z'
    };

    test('1. renders loading state while listReleases is pending', async () => {
        let resolveReleases: (res: { value: Release[]; Count: number }) => void;
        vi.spyOn(ReleasesApi, 'listReleases').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveReleases = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('modpack-loading')).toBeDefined();
        expect(screen.getByText('Loading modpacks...')).toBeDefined();

        resolveReleases!({ value: [], Count: 0 });
        await waitFor(() => {
            expect(screen.queryByTestId('modpack-loading')).toBeNull();
        });
    });

    test('2. renders visible error alert when listReleases fails', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockRejectedValueOnce(
            new ApiClientError(500, 'INTERNAL_ERROR', [], 'Failed to fetch release records')
        );

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Failed to load modpacks')).toBeDefined();
            expect(screen.getByText(/Failed to fetch release records/i)).toBeDefined();
        });
    });

    test('3. renders empty state when no modpacks exist', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({
            value: [mockLauncherRelease], // only launcher release, no modpacks
            Count: 1
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('modpack-empty-state')).toBeDefined();
            expect(screen.getByText('No modpack releases found.')).toBeDefined();
            expect(screen.getByTestId('stat-total').textContent).toContain('0');
        });
    });

    test('4. filters out launcher releases and displays only modpack releases in table', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({
            value: [mockModpackDraft, mockLauncherRelease, mockModpackPublished],
            Count: 3
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Modpack releases' })).toBeDefined();
        });

        // Modpack releases are rendered
        expect(screen.getByTestId('modpack-row-modpack-draft-1')).toBeDefined();
        expect(screen.getByTestId('modpack-row-modpack-pub-1')).toBeDefined();
        expect(screen.getByText('1.0.0')).toBeDefined();
        expect(screen.getByText('0.9.0')).toBeDefined();

        // Launcher release is NEVER rendered
        expect(screen.queryByTestId('modpack-row-launcher-rel-1')).toBeNull();
        expect(screen.queryByText('2.0.0')).toBeNull();
    });

    test('5. displays real derived counts for Total, Drafts, Published, and Deprecated in status panel', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({
            value: [mockModpackDraft, mockModpackPublished, mockModpackDeprecated, mockLauncherRelease],
            Count: 4
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('modpack-stats-panel')).toBeDefined();
        });

        expect(screen.getByTestId('stat-total').textContent).toContain('3');
        expect(screen.getByTestId('stat-drafts').textContent).toContain('1');
        expect(screen.getByTestId('stat-published').textContent).toContain('1');
        expect(screen.getByTestId('stat-deprecated').textContent).toContain('1');
    });

    test('6. renders table columns with version, channel, status badges, formatted notes or fallback, and dates', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({
            value: [mockModpackDraft, mockModpackPublished],
            Count: 2
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('table', { name: 'Modpack Releases Table' })).toBeDefined();
        });

        // Row 1: with release notes
        const row1 = screen.getByTestId('modpack-row-modpack-draft-1');
        expect(row1.textContent).toContain('1.0.0');
        expect(row1.textContent).toContain('stable');
        expect(row1.textContent).toContain('draft');
        expect(row1.textContent).toContain('Initial modpack draft release');

        // Row 2: empty release notes shows fallback
        const row2 = screen.getByTestId('modpack-row-modpack-pub-1');
        expect(row2.textContent).toContain('0.9.0');
        expect(row2.textContent).toContain('beta');
        expect(row2.textContent).toContain('published');
        expect(row2.textContent).toContain('No release notes');

        // Check Configure / View action buttons
        expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        expect(screen.getByTestId('view-modpack-modpack-pub-1')).toBeDefined();
    });

    test('7. form validation rejects empty version without calling API', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });
        const createSpy = vi.spyOn(ReleasesApi, 'createRelease');

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Create draft' })).toBeDefined();
        });

        const submitBtn = screen.getByRole('button', { name: 'Create draft' });
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Version is required.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('8. form validation rejects invalid SemVer without calling API', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });
        const createSpy = vi.spyOn(ReleasesApi, 'createRelease');

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        const versionInput = screen.getByLabelText(/Version:/i);
        const submitBtn = screen.getByRole('button', { name: 'Create draft' });

        await user.type(versionInput, 'invalid-version-string');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/Invalid version format. Please use valid SemVer/i)).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('9. POST sends exact payload with release_type: "modpack"', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });
        const createSpy = vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({
            id: 'new-modpack-1'
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        const versionInput = screen.getByLabelText(/Version:/i);
        const channelSelect = screen.getByLabelText(/Channel:/i);
        const notesInput = screen.getByLabelText(/Release notes/i);
        const submitBtn = screen.getByRole('button', { name: 'Create draft' });

        await user.type(versionInput, '  1.2.0-beta.1  ');
        await user.selectOptions(channelSelect, 'beta');
        await user.type(notesInput, 'Fresh mods and shaders');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith({
                version: '1.2.0-beta.1',
                channel: 'beta',
                release_type: 'modpack',
                release_notes: 'Fresh mods and shaders'
            });
        });
    });

    test('10. does NOT send invented fields (status, id, created_at, title, cover, mandatory, etc.) in create payload', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });
        const createSpy = vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({
            id: 'new-modpack-2'
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        await user.type(screen.getByLabelText(/Version:/i), '1.0.0');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledTimes(1);
        });

        const sentPayload = createSpy.mock.calls[0][0] as CreateReleaseInput;
        expect(sentPayload).toEqual({
            version: '1.0.0',
            channel: 'stable',
            release_type: 'modpack'
        });

        expect('status' in sentPayload).toBe(false);
        expect('id' in sentPayload).toBe(false);
        expect('created_at' in sentPayload).toBe(false);
        expect('updated_at' in sentPayload).toBe(false);
        expect('title' in sentPayload).toBe(false);
        expect('mandatory' in sentPayload).toBe(false);
        expect('cover' in sentPayload).toBe(false);
        expect('image' in sentPayload).toBe(false);
        expect('total_size' in sentPayload).toBe(false);
    });

    test('11. displays Creating... and disables all controls during POST', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });

        let resolveCreate: (res: { id: string }) => void;
        vi.spyOn(ReleasesApi, 'createRelease').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveCreate = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        const versionInput = screen.getByLabelText(/Version:/i) as HTMLInputElement;
        const channelSelect = screen.getByLabelText(/Channel:/i) as HTMLSelectElement;
        const notesInput = screen.getByLabelText(/Release notes/i) as HTMLTextAreaElement;
        const submitBtn = screen.getByRole('button', { name: 'Create draft' }) as HTMLButtonElement;

        await user.type(versionInput, '2.0.0');
        await user.click(submitBtn);

        expect(screen.getByText('Creating...')).toBeDefined();
        expect(versionInput.disabled).toBe(true);
        expect(channelSelect.disabled).toBe(true);
        expect(notesInput.disabled).toBe(true);
        expect(submitBtn.disabled).toBe(true);

        resolveCreate!({ id: 'modpack-2' });
        await waitFor(() => {
            expect(screen.queryByText('Creating...')).toBeNull();
            expect(submitBtn.disabled).toBe(false);
        });
    });

    test('12. successful POST resets form, displays confirmation message, and reloads modpack list', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockResolvedValueOnce({ value: [], Count: 0 })
            .mockResolvedValueOnce({
                value: [
                    {
                        id: 'new-modpack-id',
                        version: '1.5.0',
                        channel: 'stable',
                        release_type: 'modpack',
                        status: 'draft',
                        total_size: 0,
                        release_notes: 'First draft notes',
                        created_at: '2026-08-21T00:00:00Z',
                        updated_at: '2026-08-21T00:00:00Z'
                    }
                ],
                Count: 1
            });

        vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({
            id: 'new-modpack-id'
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        const versionInput = screen.getByLabelText(/Version:/i) as HTMLInputElement;
        const notesInput = screen.getByLabelText(/Release notes/i) as HTMLTextAreaElement;
        const submitBtn = screen.getByRole('button', { name: 'Create draft' });

        await user.type(versionInput, '1.5.0');
        await user.type(notesInput, 'First draft notes');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('✓ Modpack draft v1.5.0 created successfully.')).toBeDefined();
            // Form is reset
            expect(versionInput.value).toBe('');
            expect(notesInput.value).toBe('');
            // listReleases was called twice (mount + after create)
            expect(listSpy).toHaveBeenCalledTimes(2);
            // New draft appears in the table
            expect(screen.getByTestId('modpack-row-new-modpack-id')).toBeDefined();
            expect(screen.getAllByText('1.5.0').length).toBeGreaterThan(0);
        });
    });

    test('13. failed POST displays visible error banner and preserves form inputs', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'createRelease').mockRejectedValueOnce(
            new ApiClientError(409, 'CONFLICT', [], 'Conflict: operation not permitted in current release state.')
        );

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        const versionInput = screen.getByLabelText(/Version:/i) as HTMLInputElement;
        const notesInput = screen.getByLabelText(/Release notes/i) as HTMLTextAreaElement;
        const submitBtn = screen.getByRole('button', { name: 'Create draft' });

        await user.type(versionInput, '1.0.0');
        await user.type(notesInput, 'Draft with duplicate version');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText(/Conflict: operation not permitted in current release state/i)).toBeDefined();
            // Inputs are preserved
            expect(versionInput.value).toBe('1.0.0');
            expect(notesInput.value).toBe('Draft with duplicate version');
        });
    });

    test('14. route remains at /modpack after draft creation without navigation', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({
            id: 'created-draft-id'
        });

        let currentPath = '';
        const LocationTracker = () => {
            const loc = useLocation();
            currentPath = loc.pathname;
            return <div data-testid="path-display">{loc.pathname}</div>;
        };

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <LocationTracker />
                <Routes>
                    <Route path="/modpack" element={<ModpackPage />} />
                    <Route path="/releases/:id" element={<div>Release Details</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        await user.type(screen.getByLabelText(/Version:/i), '1.0.0');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        await waitFor(() => {
            expect(screen.getByText(/Modpack draft v1.0.0 created successfully/i)).toBeDefined();
        });

        // Path is still /modpack
        expect(currentPath).toBe('/modpack');
        expect(screen.getByTestId('path-display').textContent).toBe('/modpack');
    });

    test('15. renders Module 3B workspace preparation card', async () => {
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({ value: [], Count: 0 });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-placeholder')).toBeDefined();
        });

        expect(screen.getByText('Modpack update workspace')).toBeDefined();
        expect(screen.getByText('Select or create a draft to configure files in the next module.')).toBeDefined();
    });
});
