import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ModpackPage } from '../pages/ModpackPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { ApiClientError } from '../api/client';
import type { Release } from '../types/releases';
import type { ReleaseFile } from '../types/releaseFiles';
import type { ReleaseValidationResponse } from '../types/validation';

describe('Modpack Workspace Inline UI Functional Tests (Module 3B-1)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockModpackDraft1: Release = {
        id: 'modpack-draft-1',
        version: '1.0.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'draft',
        total_size: 1048576,
        release_notes: 'Draft 1 notes',
        created_at: '2026-08-21T00:00:00Z',
        updated_at: '2026-08-21T10:00:00Z'
    };

    const mockModpackDraft2: Release = {
        id: 'modpack-draft-2',
        version: '1.1.0',
        channel: 'beta',
        release_type: 'modpack',
        status: 'draft',
        total_size: 2048576,
        release_notes: 'Draft 2 notes',
        created_at: '2026-08-21T02:00:00Z',
        updated_at: '2026-08-21T12:00:00Z'
    };

    const mockModpackPublished: Release = {
        id: 'modpack-pub-1',
        version: '0.9.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'published',
        total_size: 5242880,
        release_notes: 'Published modpack',
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T12:00:00Z'
    };

    const mockFilesDraft1: ReleaseFile[] = [
        {
            id: 'file-mod-1',
            release_id: 'modpack-draft-1',
            path: 'mods/fabric-api.jar',
            logical_path: 'mods/fabric-api.jar',
            filename: 'fabric-api.jar',
            operation: 'add',
            size: 102400,
            sha256: 'a'.repeat(64),
            created_at: '2026-08-21T00:00:00Z'
        },
        {
            id: 'file-config-1',
            release_id: 'modpack-draft-1',
            path: 'config/options.txt',
            logical_path: 'config/options.txt',
            filename: 'options.txt',
            operation: 'replace',
            size: 512,
            sha256: 'b'.repeat(64),
            created_at: '2026-08-21T00:00:00Z'
        }
    ];

    const mockFilesDraft2: ReleaseFile[] = [
        {
            id: 'file-mod-2',
            release_id: 'modpack-draft-2',
            path: 'mods/sodium.jar',
            logical_path: 'mods/sodium.jar',
            filename: 'sodium.jar',
            operation: 'add',
            size: 204800,
            sha256: 'c'.repeat(64),
            created_at: '2026-08-21T02:00:00Z'
        }
    ];

    const mockValidationValid: ReleaseValidationResponse = {
        valid: true,
        issues: []
    };

    const mockValidationInvalid: ReleaseValidationResponse = {
        valid: false,
        issues: [
            {
                code: 'missing_files',
                message: 'No files attached to release',
                path: 'files'
            }
        ]
    };

    const LocationTracker = ({ onLocation }: { onLocation: (pathname: string) => void }) => {
        const loc = useLocation();
        onLocation(loc.pathname);
        return <div data-testid="current-pathname">{loc.pathname}</div>;
    };

    test('1. Configure button selects a draft without changing /modpack URL', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        let currentPath = '';
        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <LocationTracker onLocation={(p) => (currentPath = p)} />
                <Routes>
                    <Route path="/modpack" element={<ModpackPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
        });

        expect(currentPath).toBe('/modpack');
        expect(screen.getByTestId('current-pathname').textContent).toBe('/modpack');
    });

    test('2. Draft selected loads files and validation with its exact ID', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(listFilesSpy).toHaveBeenCalledWith('modpack-draft-1');
            expect(valSpy).toHaveBeenCalledWith('modpack-draft-1');
        });
    });

    test('3. ReleaseFilesTable displays real files', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getAllByText('mods/fabric-api.jar').length).toBeGreaterThan(0);
            expect(screen.getAllByText('config/options.txt').length).toBeGreaterThan(0);
        });
    });

    test('4. Draft workspace renders ReleaseFileForm', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByTestId('local-file-inspect')).toBeDefined();
            expect(screen.getByLabelText(/Operation/i)).toBeDefined();
            expect(screen.getByTestId('submit-asset-btn')).toBeDefined();
        });
    });

    test('5. Published/deprecated modpacks remain strictly read-only without form or edit/delete actions', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackPublished],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: [
                {
                    id: 'pub-file-1',
                    release_id: 'modpack-pub-1',
                    path: 'mods/published-mod.jar',
                    logical_path: 'mods/published-mod.jar',
                    filename: 'published-mod.jar',
                    operation: 'add',
                    size: 50000,
                    sha256: 'e'.repeat(64),
                    created_at: '2026-08-15T00:00:00Z'
                }
            ],
            Count: 1
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('view-modpack-modpack-pub-1')).toBeDefined();
            expect(screen.queryByTestId('configure-modpack-modpack-pub-1')).toBeNull();
        });

        await user.click(screen.getByTestId('view-modpack-modpack-pub-1'));

        await waitFor(() => {
            expect(screen.getByText('Workspace: v0.9.0')).toBeDefined();
            expect(screen.getAllByText('mods/published-mod.jar').length).toBeGreaterThan(0);
        });

        // Form and edit/delete buttons MUST NOT exist
        expect(screen.queryByTestId('local-file-inspect')).toBeNull();
        expect(screen.queryByTestId('submit-asset-btn')).toBeNull();
        expect(screen.queryByRole('button', { name: /^Edit$/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Delete$/i })).toBeNull();
    });

    test('6. Changing selected release uses the new ID', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1, mockModpackDraft2],
            Count: 2
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockImplementation(async (id) => {
            if (id === 'modpack-draft-1') return { value: mockFilesDraft1, Count: 2 };
            return { value: mockFilesDraft2, Count: 1 };
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
            expect(screen.getByTestId('configure-modpack-modpack-draft-2')).toBeDefined();
        });

        // Select Draft 1
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
            expect(screen.getAllByText('mods/fabric-api.jar').length).toBeGreaterThan(0);
        });

        // Select Draft 2
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-2'));
        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.1.0')).toBeDefined();
            expect(screen.getAllByText('mods/sodium.jar').length).toBeGreaterThan(0);
            expect(screen.queryByText('mods/fabric-api.jar')).toBeNull();
        });

        expect(listFilesSpy).toHaveBeenCalledWith('modpack-draft-2');
    });

    test('7. Stale response from previous selection does not overwrite the active workspace', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1, mockModpackDraft2],
            Count: 2
        });

        let resolveDraft1Files: ((res: { value: ReleaseFile[]; Count: number }) => void) | undefined;
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockImplementation(async (id) => {
            if (id === 'modpack-draft-1') {
                return new Promise((resolve) => {
                    resolveDraft1Files = resolve;
                });
            }
            return { value: mockFilesDraft2, Count: 1 };
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        // Select Draft 1 (slow response)
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        // Quickly switch to Draft 2
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-2'));

        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.1.0')).toBeDefined();
            expect(screen.getAllByText('mods/sodium.jar').length).toBeGreaterThan(0);
        });

        // Slower response from Draft 1 finishes now
        resolveDraft1Files?.({ value: mockFilesDraft1, Count: 2 });

        // Workspace should STILL show Draft 2
        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.1.0')).toBeDefined();
            expect(screen.getAllByText('mods/sodium.jar').length).toBeGreaterThan(0);
            expect(screen.queryByText('mods/fabric-api.jar')).toBeNull();
        });
    });

    test('8. Close workspace cleans up workspace content and restores placeholder', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
        });

        // Click Close workspace
        await user.click(screen.getByTestId('close-workspace-btn'));

        await waitFor(() => {
            expect(screen.queryByTestId('modpack-workspace-section')).toBeNull();
            expect(screen.getByTestId('modpack-workspace-placeholder')).toBeDefined();
        });
    });

    test('9. Successful Add reloads files and validation', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles')
            .mockResolvedValueOnce({ value: [], Count: 0 })
            .mockResolvedValueOnce({ value: [mockFilesDraft1[0]], Count: 1 });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleaseFilesApi, 'createReleaseFile').mockResolvedValue({
            id: 'file-mod-1',
            status: 'created'
        });
        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockResolvedValue({
            status: 'ok',
            verified: true,
            asset: { id: 10, name: 'fabric-api.jar' }
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByTestId('local-file-inspect')).toBeDefined();
        });

        const fileInput = screen.getByTestId('local-file-inspect') as HTMLInputElement;
        const fakeFile = new File(['1234567890'], 'fabric-api.jar', { type: 'application/java-archive' });
        await user.upload(fileInput, fakeFile);

        await waitFor(() => {
            expect(screen.getByTestId('plan-type-badge')).toBeDefined();
        });

        await user.click(screen.getByTestId('submit-asset-btn'));

        await waitFor(() => {
            expect(listFilesSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
            expect(screen.getAllByText('mods/fabric-api.jar').length).toBeGreaterThan(0);
        });
    });

    test('10. Edit sends PATCH payload via existing flow and reloads files and validation', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles')
            .mockResolvedValueOnce({ value: [mockFilesDraft1[0]], Count: 1 })
            .mockResolvedValueOnce({
                value: [
                    {
                        ...mockFilesDraft1[0],
                        size: 204800
                    }
                ],
                Count: 1
            });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const updateSpy = vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockResolvedValue({
            status: 'ok'
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit fabric-api.jar' })).toBeDefined();
        });

        // Click Edit
        await user.click(screen.getByRole('button', { name: 'Edit fabric-api.jar' }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Edit Release File: fabric-api.jar' })).toBeDefined();
        });

        const sizeInput = screen.getByLabelText('Size (bytes)');
        await user.clear(sizeInput);
        await user.type(sizeInput, '204800');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith('modpack-draft-1', 'file-mod-1', {
                size: 204800
            });
            expect(listFilesSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
        });
    });

    test('11. Delete file uses exact ID and reloads files and validation', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles')
            .mockResolvedValueOnce({ value: [mockFilesDraft1[0]], Count: 1 })
            .mockResolvedValueOnce({ value: [], Count: 0 });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const deleteSpy = vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile').mockResolvedValue({
            status: 'ok'
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete fabric-api.jar' })).toBeDefined();
        });

        // Click Delete
        await user.click(screen.getByRole('button', { name: 'Delete fabric-api.jar' }));

        await waitFor(() => {
            expect(deleteSpy).toHaveBeenCalledWith('modpack-draft-1', 'file-mod-1');
            expect(listFilesSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
        });
    });

    test('12. Files fetch error is visible in an alert', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockRejectedValueOnce(
            new ApiClientError(500, 'INTERNAL_ERROR', [], 'Failed to fetch release files from storage')
        );
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch release files from storage/i)).toBeDefined();
        });
    });

    test('13. Validation error is visible separately from files table', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockRejectedValueOnce(
            new ApiClientError(500, 'INTERNAL_ERROR', [], 'Validation service unavailable')
        );

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByText(/Validation service unavailable/i)).toBeDefined();
            // Files table is still loaded properly
            expect(screen.getAllByText('mods/fabric-api.jar').length).toBeGreaterThan(0);
        });
    });

    test('14. Re-validate button triggers revalidation call', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: [],
            Count: 0
        });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease')
            .mockResolvedValueOnce(mockValidationInvalid)
            .mockResolvedValueOnce(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByText(/Release is not ready for publishing/i)).toBeDefined();
            expect(screen.getByText(/missing_files:/i)).toBeDefined();
            expect(screen.getByText(/No files attached to release/i)).toBeDefined();
        });

        // Click Re-validate
        await user.click(screen.getByTestId('revalidate-btn'));

        await waitFor(() => {
            expect(valSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByText('✓ Release is valid and ready for publishing.')).toBeDefined();
        });
    });

    test('15. Creating a new draft automatically selects it and opens its workspace with the returned real ID', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockResolvedValueOnce({ value: [], Count: 0 })
            .mockResolvedValueOnce({
                value: [
                    {
                        id: 'newly-created-modpack-id',
                        version: '2.0.0',
                        channel: 'stable',
                        release_type: 'modpack',
                        status: 'draft',
                        total_size: 0,
                        release_notes: 'New draft created inline',
                        created_at: '2026-08-21T00:00:00Z',
                        updated_at: '2026-08-21T00:00:00Z'
                    }
                ],
                Count: 1
            });

        vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({
            id: 'newly-created-modpack-id'
        });

        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: [],
            Count: 0
        });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        let currentPath = '';
        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <LocationTracker onLocation={(p) => (currentPath = p)} />
                <Routes>
                    <Route path="/modpack" element={<ModpackPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        await user.type(screen.getByLabelText(/Version:/i), '2.0.0');
        await user.type(screen.getByLabelText(/Release notes/i), 'New draft created inline');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        await waitFor(() => {
            expect(screen.getByText('✓ Modpack draft v2.0.0 created successfully.')).toBeDefined();
            // Automatically selected and opened workspace with newly created ID
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
            expect(screen.getByText('Workspace: v2.0.0')).toBeDefined();
            expect(listFilesSpy).toHaveBeenCalledWith('newly-created-modpack-id');
            expect(valSpy).toHaveBeenCalledWith('newly-created-modpack-id');
            expect(listSpy).toHaveBeenCalledTimes(2);
        });

        // Path is still /modpack
        expect(currentPath).toBe('/modpack');
    });

    test('16. URL continuously remains /modpack during all workspace interactions', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1, mockModpackPublished],
            Count: 2
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: mockFilesDraft1,
            Count: 2
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        let currentPath = '';
        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <LocationTracker onLocation={(p) => (currentPath = p)} />
                <Routes>
                    <Route path="/modpack" element={<ModpackPage />} />
                    <Route path="/releases/:id" element={<div>Release details page</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        // Configure draft
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
        });
        expect(currentPath).toBe('/modpack');

        // View published
        await user.click(screen.getByTestId('view-modpack-modpack-pub-1'));
        await waitFor(() => {
            expect(screen.getByText('Workspace: v0.9.0')).toBeDefined();
        });
        expect(currentPath).toBe('/modpack');

        // Close workspace
        await user.click(screen.getByTestId('close-workspace-btn'));
        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-placeholder')).toBeDefined();
        });
        expect(currentPath).toBe('/modpack');
    });

    test('17. No real network calls are executed and mocked API handlers serve all interactions', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: [],
            Count: 0
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    // ==========================================
    // TAREA 1 — PROHIBIR RELEASES SINTÉTICOS
    // ==========================================
    test('18. when created draft is not present in listReleases reload, calls getRelease(id) and uses the real record', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockResolvedValueOnce({ value: [], Count: 0 }) // initial list
            .mockResolvedValueOnce({ value: [], Count: 0 }); // list reload does NOT contain new ID yet

        vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({
            id: 'real-backend-modpack-id'
        });

        const realModpackFromApi: Release = {
            id: 'real-backend-modpack-id',
            version: '3.0.0',
            channel: 'beta',
            release_type: 'modpack',
            status: 'draft',
            total_size: 4096,
            release_notes: 'Real backend release notes',
            created_at: '2026-08-21T15:00:00Z',
            updated_at: '2026-08-21T15:00:00Z'
        };

        const getReleaseSpy = vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(realModpackFromApi);
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Version:/i)).toBeDefined();
        });

        await user.type(screen.getByLabelText(/Version:/i), '3.0.0');
        await user.click(screen.getByRole('button', { name: 'Create draft' }));

        await waitFor(() => {
            expect(getReleaseSpy).toHaveBeenCalledWith('real-backend-modpack-id');
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
            expect(screen.getByText('Workspace: v3.0.0')).toBeDefined();
            expect(listFilesSpy).toHaveBeenCalledWith('real-backend-modpack-id');
            expect(valSpy).toHaveBeenCalledWith('real-backend-modpack-id');
        });

        expect(listSpy).toHaveBeenCalledTimes(2);
    });

    // ==========================================
    // TAREA 2 — RECARGAR DESPUÉS DE UPLOAD MANUAL
    // ==========================================
    test('19. onAssetUploaded reloads both listReleaseFiles and validateRelease after manual upload in table', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1],
            Count: 1
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles')
            .mockResolvedValueOnce({ value: [mockFilesDraft1[0]], Count: 1 }) // initial load in workspace
            .mockResolvedValueOnce({ value: [mockFilesDraft1[0]], Count: 1 }); // reload after onAssetUploaded
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease')
            .mockResolvedValueOnce(mockValidationInvalid) // initial validation
            .mockResolvedValueOnce(mockValidationValid); // reload validation

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockResolvedValue({
            status: 'ok',
            verified: true,
            asset: { id: 42, name: 'fabric-api.jar' }
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
            expect(screen.getByLabelText(/Upload file for fabric-api.jar/i)).toBeDefined();
        });

        const uploadInput = screen.getByLabelText(/Upload file for fabric-api.jar/i) as HTMLInputElement;
        const fakeFile = new File(['mock-binary-data'], 'fabric-api.jar', { type: 'application/java-archive' });
        await user.upload(uploadInput, fakeFile);

        await waitFor(() => {
            // Both files and validation were reloaded via onAssetUploaded
            expect(listFilesSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByTestId('upload-ready-file-mod-1')).toBeDefined();
            expect(screen.getByText('✓ Release is valid and ready for publishing.')).toBeDefined();
        });
    });

    // ==========================================
    // TAREA 3 — LIMPIEZA Y CONCURRENCIA
    // ==========================================
    test('20. mutation in progress disables Configure, View, and Close workspace and blocks switching release', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1, mockModpackDraft2],
            Count: 2
        });
        const listFilesSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: [mockFilesDraft1[0]],
            Count: 1
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        let resolveUpdateFile: ((res: { status: 'ok' }) => void) | undefined;
        vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockImplementation(() => {
            return new Promise((resolve) => {
                resolveUpdateFile = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
            expect(screen.getByTestId('configure-modpack-modpack-draft-2')).toBeDefined();
        });

        // Open workspace for Draft 1
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit fabric-api.jar' })).toBeDefined();
        });

        // Open edit form
        await user.click(screen.getByRole('button', { name: 'Edit fabric-api.jar' }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Edit Release File: fabric-api.jar' })).toBeDefined();
        });

        const sizeInput = screen.getByLabelText('Size (bytes)');
        await user.clear(sizeInput);
        await user.type(sizeInput, '999999');

        // Trigger update (initiates pending mutation)
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        // During pending mutation:
        const configBtn1 = screen.getByTestId('configure-modpack-modpack-draft-1') as HTMLButtonElement;
        const configBtn2 = screen.getByTestId('configure-modpack-modpack-draft-2') as HTMLButtonElement;
        const closeBtn = screen.getByTestId('close-workspace-btn') as HTMLButtonElement;

        await waitFor(() => {
            expect(configBtn1.disabled).toBe(true);
            expect(configBtn2.disabled).toBe(true);
            expect(closeBtn.disabled).toBe(true);
        });

        // Attempting to click Configure Draft 2 while disabled does nothing
        await user.click(configBtn2);
        expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
        expect(listFilesSpy).not.toHaveBeenCalledWith('modpack-draft-2');

        // Attempting to click Close workspace while disabled does nothing
        await user.click(closeBtn);
        expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();

        // Resolve mutation
        resolveUpdateFile?.({ status: 'ok' });

        await waitFor(() => {
            expect(closeBtn.disabled).toBe(false);
            expect(configBtn1.disabled).toBe(false);
            expect(configBtn2.disabled).toBe(false);
        });
    });
});
