import { test, expect, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ModpackPage } from '../pages/ModpackPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { ApiClientError } from '../api/client';
import type { Release } from '../types/releases';
import type { ReleaseFile } from '../types/releaseFiles';
import type { ReleaseValidationResponse } from '../types/validation';

describe('Modpack Safe Purge Everywhere UI Tests (Phase 7F)', () => {
    const mockModpackDraft1: Release = {
        id: 'modpack-draft-1',
        version: '1.0.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'draft',
        total_size: 1024,
        release_notes: 'Draft release notes',
        created_at: '2026-08-20T10:00:00Z',
        updated_at: '2026-08-20T10:00:00Z'
    };

    const mockModpackPublished: Release = {
        id: 'modpack-pub-1',
        version: '2.0.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'published',
        total_size: 2048,
        release_notes: 'Published modpack',
        created_at: '2026-08-19T10:00:00Z',
        updated_at: '2026-08-19T10:00:00Z'
    };

    const mockModpackDeprecated: Release = {
        id: 'modpack-dep-1',
        version: '0.5.0',
        channel: 'beta',
        release_type: 'modpack',
        status: 'deprecated',
        total_size: 512,
        release_notes: 'Deprecated modpack',
        created_at: '2026-08-18T10:00:00Z',
        updated_at: '2026-08-18T10:00:00Z'
    };

    const mockFiles: ReleaseFile[] = [
        {
            id: 'file-1',
            release_id: 'modpack-draft-1',
            path: 'mods/fabric-api.jar',
            logical_path: 'mods/fabric-api.jar',
            filename: 'fabric-api.jar',
            operation: 'add',
            size: 512,
            sha256: 'a'.repeat(64),
            part_index: null,
            part_count: null,
            final_sha256: null,
            created_at: '2026-08-20T10:00:00Z'
        }
    ];

    const mockValidationValid: ReleaseValidationResponse = {
        valid: true,
        issues: []
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // 1. DANGER ZONE APARECE EN DRAFTS CON DUAL CONFIRMACIÓN
    test('1. Danger Zone controls appear in draft releases with dual confirmation inputs', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1, mockModpackPublished],
            Count: 2
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
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
            expect(screen.getByTestId('danger-zone-section')).toBeDefined();
            expect(screen.getByTestId('draft-danger-zone-controls')).toBeDefined();
            expect(screen.getByTestId('confirm-delete-version-input')).toBeDefined();
            expect(screen.getByTestId('confirm-delete-phrase-input')).toBeDefined();
            expect(screen.getByTestId('delete-draft-everywhere-btn')).toBeDefined();
            expect(screen.queryByTestId('published-release-warning')).toBeNull();
        });
    });

    // 2. PUBLISHED Y DEPRECATED MUESTRAN ADVERTENCIA Y CONTROLES DE PURGA
    test('2. Published and deprecated releases show warning banner and purge controls', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackPublished, mockModpackDeprecated],
            Count: 2
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('view-modpack-modpack-pub-1')).toBeDefined();
        });

        // Click published release
        await user.click(screen.getByTestId('view-modpack-modpack-pub-1'));

        await waitFor(() => {
            expect(screen.getByTestId('published-release-warning')).toBeDefined();
            expect(screen.getByTestId('published-release-warning').textContent).toContain('published');
            expect(screen.getByTestId('delete-draft-everywhere-btn')).toBeDefined();
            expect(screen.getByTestId('confirm-delete-version-input')).toBeDefined();
            expect(screen.getByTestId('confirm-delete-phrase-input')).toBeDefined();
        });

        // Click deprecated release
        await user.click(screen.getByTestId('view-modpack-modpack-dep-1'));

        await waitFor(() => {
            expect(screen.getByTestId('published-release-warning')).toBeDefined();
            expect(screen.getByTestId('published-release-warning').textContent).toContain('deprecated');
            expect(screen.getByTestId('delete-draft-everywhere-btn')).toBeDefined();
        });
    });

    // 3. CONFIRMACIÓN VACÍA O INCORRECTA NO LLAMA A LA API
    test('3. Empty or mismatched confirm_version or confirm_phrase keeps button disabled', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const deleteSpy = vi.spyOn(ReleasesApi, 'deleteModpackEverywhere');

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
            const deleteBtn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
            expect(deleteBtn.disabled).toBe(true);
        });

        const verInput = screen.getByTestId('confirm-delete-version-input');
        const phraseInput = screen.getByTestId('confirm-delete-phrase-input');

        // Type only version
        await user.type(verInput, '1.0.0');
        expect((screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement).disabled).toBe(true);

        // Type incorrect phrase
        await user.type(phraseInput, 'DELETE 9.9.9');
        expect((screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement).disabled).toBe(true);

        expect(deleteSpy).not.toHaveBeenCalled();
    });

    // 4. REQUEST EXACTO CON ID, VERSION Y PHRASE
    test('4. Exact version and phrase confirmation enables button and dispatches deleteModpackEverywhere', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const deleteSpy = vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockResolvedValue({
            status: 'ok',
            deleted: true,
            purged: true,
            release_id: 'modpack-draft-1',
            github_release_deleted: false,
            github_tag_deleted: false,
            d1_deleted: true
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

        const verInput = await screen.findByTestId('confirm-delete-version-input');
        const phraseInput = await screen.findByTestId('confirm-delete-phrase-input');

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        const deleteBtn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
        expect(deleteBtn.disabled).toBe(false);

        await user.click(deleteBtn);

        await waitFor(() => {
            expect(deleteSpy).toHaveBeenCalledWith('modpack-draft-1', '1.0.0', 'DELETE 1.0.0');
        });
    });

    // 5. ESTADO PENDIENTE DESHABILITA WORKSPACE Y EVITA DOBLE ENVÍO
    test('5. Pending deletion displays Deleting everywhere..., disables controls, and avoids double submission', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        let resolveDelete: ((res: { status: string; deleted: boolean; release_id: string; github_release_deleted: boolean; github_tag_deleted: boolean; d1_deleted: boolean }) => void) | undefined;
        const deleteSpy = vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockImplementation(() => new Promise((resolve) => {
            resolveDelete = resolve;
        }));

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        const verInput = await screen.findByTestId('confirm-delete-version-input');
        const phraseInput = await screen.findByTestId('confirm-delete-phrase-input');

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        await waitFor(() => {
            const btn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));

        // Verify pending state
        await waitFor(() => {
            const btn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
            expect(btn.textContent).toContain('Deleting everywhere...');
            expect(btn.disabled).toBe(true);
        });

        // Fast duplicate click should not trigger second API call
        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));
        expect(deleteSpy).toHaveBeenCalledTimes(1);

        // Resolve deletion
        resolveDelete?.({
            status: 'ok',
            deleted: true,
            release_id: 'modpack-draft-1',
            github_release_deleted: false,
            github_tag_deleted: false,
            d1_deleted: true
        });

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-placeholder')).toBeDefined();
        });
    });

    // 6. ERROR CONSERVA EL WORKSPACE
    test('6. API deletion error displays visible error banner without alert and preserves workspace', async () => {
        const user = userEvent.setup();
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockRejectedValue(new Error('GitHub credentials required to delete GitHub release'));

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        const verInput = await screen.findByTestId('confirm-delete-version-input');
        const phraseInput = await screen.findByTestId('confirm-delete-phrase-input');

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        await waitFor(() => {
            const btn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));

        await waitFor(() => {
            const errorAlert = screen.getByTestId('delete-draft-error-alert');
            expect(errorAlert.textContent).toContain('GitHub credentials required to delete GitHub release');
            expect(alertSpy).not.toHaveBeenCalled();
            // Workspace remains open and interactive
            expect(screen.getByTestId('modpack-workspace-section')).toBeDefined();
            expect(screen.getByTestId('danger-zone-section')).toBeDefined();
        });
    });

    // 7. ÉXITO CIERRA EL WORKSPACE Y RECARGA LA LISTA
    test('7. Successful deletion closes workspace and reloads releases list', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockResolvedValueOnce({ value: [mockModpackDraft1], Count: 1 })
            .mockResolvedValueOnce({ value: [], Count: 0 });

        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockResolvedValue({
            status: 'ok',
            deleted: true,
            purged: true,
            release_id: 'modpack-draft-1',
            github_release_deleted: false,
            github_tag_deleted: false,
            d1_deleted: true
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

        const verInput = await screen.findByTestId('confirm-delete-version-input');
        const phraseInput = await screen.findByTestId('confirm-delete-phrase-input');

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));

        await waitFor(() => {
            // Workspace is closed, placeholder is visible
            expect(screen.getByTestId('modpack-workspace-placeholder')).toBeDefined();
            expect(screen.queryByTestId('danger-zone-section')).toBeNull();
            // listReleases called to reload list
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    // 8. LA URL PERMANECE /modpack
    test('8. URL continuously remains /modpack during deletion lifecycle', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockResolvedValue({
            status: 'ok',
            deleted: true,
            purged: true,
            release_id: 'modpack-draft-1',
            github_release_deleted: false,
            github_tag_deleted: false,
            d1_deleted: true
        });

        let currentPath = '';
        const LocationTracker = () => {
            const location = useLocation();
            currentPath = location.pathname;
            return <div data-testid="location-path">{location.pathname}</div>;
        };

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <LocationTracker />
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        const verInput = await screen.findByTestId('confirm-delete-version-input');
        const phraseInput = await screen.findByTestId('confirm-delete-phrase-input');

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('modpack-workspace-placeholder')).toBeDefined();
        });

        // Confirm no redirect occurred and pathname remained /modpack
        expect(currentPath).toBe('/modpack');
        expect(screen.getByTestId('location-path').textContent).toBe('/modpack');
    });

    // 9. PURGE_ENDPOINT_UNAVAILABLE 503 ERROR
    test('9. Displays explicit PURGE_ENDPOINT_UNAVAILABLE message and keeps inputs for retry', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const purgeUnavailableError = new ApiClientError(
            503,
            'PURGE_ENDPOINT_UNAVAILABLE',
            [],
            'The purge endpoint is unavailable or the updated Worker API has not been deployed. No resources were deleted.',
            {
                github_release: 'pending',
                github_tag: 'pending',
                d1: 'pending'
            },
            'not_present'
        );

        vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockRejectedValue(purgeUnavailableError);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        const verInput = (await screen.findByTestId('confirm-delete-version-input')) as HTMLInputElement;
        const phraseInput = (await screen.findByTestId('confirm-delete-phrase-input')) as HTMLInputElement;

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));

        await waitFor(() => {
            const errorAlert = screen.getByTestId('delete-draft-error-alert');
            expect(errorAlert.textContent).toContain('The updated Worker purge endpoint is not available');
            expect(errorAlert.textContent).toContain('Apply the migration and deploy apps/api before retrying');
            // Inputs are preserved
            expect(verInput.value).toBe('1.0.0');
            expect(phraseInput.value).toBe('DELETE 1.0.0');
            // Button is re-enabled
            const btn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });
    });

    // 10. PARTIAL_DELETION_ERROR WITH STRUCTURED STEPS
    test('10. Displays structured partial deletion status box when partial error occurs', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFiles, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const partialError = new ApiClientError(
            500,
            'PARTIAL_DELETION_ERROR',
            [],
            'GitHub resources were processed, but failed to delete release metadata from D1',
            {
                github_release: 'deleted',
                github_tag: 'failed',
                d1: 'pending'
            },
            'canonical_tag_lookup'
        );

        vi.spyOn(ReleasesApi, 'deleteModpackEverywhere').mockRejectedValue(partialError);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));

        const verInput = (await screen.findByTestId('confirm-delete-version-input')) as HTMLInputElement;
        const phraseInput = (await screen.findByTestId('confirm-delete-phrase-input')) as HTMLInputElement;

        await user.type(verInput, '1.0.0');
        await user.type(phraseInput, 'DELETE 1.0.0');

        await user.click(screen.getByTestId('delete-draft-everywhere-btn'));

        await waitFor(() => {
            const partialAlert = screen.getByTestId('delete-draft-partial-alert');
            expect(partialAlert.textContent).toContain('Partial deletion');
            expect(partialAlert.textContent).toContain('GitHub Release: deleted');
            expect(partialAlert.textContent).toContain('Git tag: failed');
            expect(partialAlert.textContent).toContain('D1 metadata: pending');
            expect(partialAlert.textContent).toContain('You may safely retry this operation');

            // Button is re-enabled for safe retry
            const btn = screen.getByTestId('delete-draft-everywhere-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });
    });
});
