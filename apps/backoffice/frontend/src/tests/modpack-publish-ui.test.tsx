import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ModpackPage } from '../pages/ModpackPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import type {
    Release,
    GitHubReleasePrepareResponse,
    GitHubReleaseStatusResponse
} from '../types/releases';
import type { ReleaseFile } from '../types/releaseFiles';
import type { ReleaseValidationResponse } from '../types/validation';

describe('Modpack Publish & GitHub Integration UI Functional Tests (Module 3B-2)', () => {
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
        version: '2.0.0',
        channel: 'beta',
        release_type: 'modpack',
        status: 'draft',
        total_size: 2097152,
        release_notes: 'Draft 2 notes',
        created_at: '2026-08-21T01:00:00Z',
        updated_at: '2026-08-21T11:00:00Z'
    };

    const mockModpackPublished: Release = {
        id: 'modpack-pub-1',
        version: '0.9.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'published',
        total_size: 5242880,
        release_notes: 'Published modpack notes',
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T12:00:00Z'
    };

    const mockModpackDeprecated: Release = {
        id: 'modpack-dep-1',
        version: '0.8.0',
        channel: 'stable',
        release_type: 'modpack',
        status: 'deprecated',
        total_size: 3145728,
        release_notes: 'Deprecated modpack notes',
        created_at: '2026-08-10T00:00:00Z',
        updated_at: '2026-08-10T12:00:00Z'
    };

    const mockFilesDraft: ReleaseFile[] = [
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

    const mockValidationValid: ReleaseValidationResponse = {
        valid: true,
        issues: []
    };

    const mockValidationInvalid: ReleaseValidationResponse = {
        valid: false,
        issues: [
            {
                code: 'missing_files',
                message: 'No files attached',
                path: 'files'
            }
        ]
    };

    const mockPrepareResponse: GitHubReleasePrepareResponse = {
        github_tag: 'v1.0.0-modpack',
        github_release_id: 12345678,
        expectedAssets: [
            { fileId: 'file-mod-1', name: 'fabric-api.jar' }
        ]
    };

    const mockGitHubStatusReady: GitHubReleaseStatusResponse = {
        status: 'ready',
        assetStatuses: {
            'file-mod-1': {
                status: 'ready',
                github_asset_id: 998877,
                download_url: 'https://github.com/releases/download/v1.0.0/fabric-api.jar'
            },
            'file-config-1': {
                status: 'ready',
                github_asset_id: 998878
            }
        },
        unexpectedAssets: []
    };

    const mockGitHubStatusSyncing: GitHubReleaseStatusResponse = {
        status: 'syncing',
        assetStatuses: {
            'file-mod-1': {
                status: 'asset_not_uploaded'
            },
            'file-config-1': {
                status: 'digest_mismatch',
                github_asset_id: 998878
            }
        },
        unexpectedAssets: [
            { id: 777, name: 'extra-rogue-file.zip' }
        ]
    };

    const LocationTracker = ({ onLocation }: { onLocation: (pathname: string) => void }) => {
        const loc = useLocation();
        onLocation(loc.pathname);
        return <div data-testid="current-pathname">{loc.pathname}</div>;
    };

    // ==========================================
    // 1. VALIDACIÓN INVÁLIDA DESHABILITA PREPARE
    // ==========================================
    test('1. Invalid validation disables Prepare button and API is not called', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationInvalid);

        const prepareSpy = vi.spyOn(ReleasesApi, 'prepareGitHubRelease');

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
            expect(screen.getByTestId('validation-warning-banner')).toBeDefined();
        });

        const prepareBtn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
        expect(prepareBtn.disabled).toBe(true);

        await user.click(prepareBtn);
        expect(prepareSpy).not.toHaveBeenCalled();
    });

    // ==========================================
    // 2. VALIDACIÓN PENDIENTE IMPIDE PREPARE
    // ==========================================
    test('2. Pending validation prevents Prepare', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });

        let resolveValidation: ((res: ReleaseValidationResponse) => void) | undefined;
        vi.spyOn(ReleasesApi, 'validateRelease').mockImplementation(() => {
            return new Promise((resolve) => {
                resolveValidation = resolve;
            });
        });

        const prepareSpy = vi.spyOn(ReleasesApi, 'prepareGitHubRelease');

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
            expect(screen.getByTestId('validation-loading')).toBeDefined();
        });

        const prepareBtn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
        expect(prepareBtn.disabled).toBe(true);

        await user.click(prepareBtn);
        expect(prepareSpy).not.toHaveBeenCalled();

        resolveValidation?.(mockValidationValid);

        await waitFor(() => {
            expect(prepareBtn.disabled).toBe(false);
        });
    });

    // ==========================================
    // 3. GITHUB SYNCING IMPIDE PUBLISH
    // ==========================================
    test('3. GitHub syncing status prevents Publish and API is not called', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusSyncing);

        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease');

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('syncing');
        });

        const publishBtn = screen.getByTestId('publish-release-btn') as HTMLButtonElement;
        expect(publishBtn.disabled).toBe(true);

        await user.click(publishBtn);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    // ==========================================
    // 4. GITHUB NO COMPROBADO IMPIDE PUBLISH
    // ==========================================
    test('4. Unchecked GitHub release prevents Publish', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease');

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
            expect(screen.getByTestId('github-unprepared-notice')).toBeDefined();
        });

        const publishBtn = screen.getByTestId('publish-release-btn') as HTMLButtonElement;
        const confirmInput = screen.getByTestId('confirm-version-input') as HTMLInputElement;

        expect(publishBtn.disabled).toBe(true);
        expect(confirmInput.disabled).toBe(true);

        await user.click(publishBtn);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    // ==========================================
    // 5. CONFIRMACIÓN INCORRECTA IMPIDE PUBLISH
    // ==========================================
    test('5. Incorrect version confirmation prevents Publish', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease');

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
        });

        const confirmInput = screen.getByTestId('confirm-version-input');
        await user.type(confirmInput, '9.9.9');

        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('publish-error-alert')).toBeDefined();
            expect(screen.getByText(/Version confirmation does not match "1.0.0"/i)).toBeDefined();
            expect(publishSpy).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // 6. TODOS LOS REQUISITOS PERMITEN PUBLISH
    // ==========================================
    test('6. All valid requirements allow Publish and call publishRelease', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease').mockResolvedValue({ status: 'published' });
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue({
            ...mockModpackDraft1,
            status: 'published'
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
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
        });

        const confirmInput = screen.getByTestId('confirm-version-input');
        await user.type(confirmInput, '1.0.0');

        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(publishSpy).toHaveBeenCalledWith('modpack-draft-1', '1.0.0');
            expect(screen.getByTestId('publish-success-alert')).toBeDefined();
        });
    });

    // ==========================================
    // 7. GETRELEASE() DEVOLVIENDO DRAFT NO MUESTRA ÉXITO
    // ==========================================
    test('7. getRelease() returning draft does not show success and displays an error', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

        vi.spyOn(ReleasesApi, 'publishRelease').mockResolvedValue({ status: 'published' });
        // Server still returns status: 'draft' despite 200 from publish
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue({
            ...mockModpackDraft1,
            status: 'draft'
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
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
        });

        await user.type(screen.getByTestId('confirm-version-input'), '1.0.0');
        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('publish-error-alert')).toBeDefined();
            expect(screen.getByText(/Publish failed: release status was not updated to published on the server/i)).toBeDefined();
            expect(screen.queryByTestId('publish-success-alert')).toBeNull();
        });
    });

    // ==========================================
    // 8. ÉXITO APARECE SOLO CON GETRELEASE PUBLISHED
    // ==========================================
    test('8. Success appears only when getRelease() returns status published', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

        vi.spyOn(ReleasesApi, 'publishRelease').mockResolvedValue({ status: 'published' });
        const getReleaseSpy = vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue({
            ...mockModpackDraft1,
            status: 'published'
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
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
        });

        await user.type(screen.getByTestId('confirm-version-input'), '1.0.0');
        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(getReleaseSpy).toHaveBeenCalledWith('modpack-draft-1');
            expect(screen.getByTestId('publish-success-alert')).toBeDefined();
            expect(screen.getByTestId('already-published-alert')).toBeDefined();
        });
    });

    // ==========================================
    // 9. RESPUESTA TARDÍA DE OTRA RELEASE NO ALTERA LA SELECCIONADA
    // ==========================================
    test('9. Late response from another release does not alter currently selected release', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({
            value: [mockModpackDraft1, mockModpackDraft2],
            Count: 2
        });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });

        let resolveDraft1Validation: ((res: ReleaseValidationResponse) => void) | undefined;
        vi.spyOn(ReleasesApi, 'validateRelease').mockImplementation(async (id) => {
            if (id === 'modpack-draft-1') {
                return new Promise((resolve) => {
                    resolveDraft1Validation = resolve;
                });
            }
            return mockValidationValid;
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

        // 1. Select Draft 1 (validation will be pending)
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
        });

        // 2. Switch to Draft 2 before Draft 1 validation resolves
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-2'));

        await waitFor(() => {
            expect(screen.getByText('Workspace: v2.0.0')).toBeDefined();
            expect(screen.getByTestId('validation-success-banner')).toBeDefined();
        });

        // 3. Draft 1's slow response resolves with invalid issues
        resolveDraft1Validation?.(mockValidationInvalid);

        // 4. Draft 2 must remain valid and must not display Draft 1's invalid warning banner
        await waitFor(() => {
            expect(screen.getByText('Workspace: v2.0.0')).toBeDefined();
            expect(screen.getByTestId('validation-success-banner')).toBeDefined();
            expect(screen.queryByTestId('validation-warning-banner')).toBeNull();
        });
    });

    // ==========================================
    // 10. SUBIDA POSTERIOR A PREPARE RECARGA GITHUB STATUS
    // ==========================================
    test('10. File upload after Prepare re-checks GitHub status', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockResolvedValue(mockPrepareResponse);
        const statusSpy = vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus')
            .mockResolvedValueOnce(mockGitHubStatusSyncing) // first check after prepare
            .mockResolvedValueOnce(mockGitHubStatusReady); // check after asset upload

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
            const btn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        await user.click(screen.getByTestId('prepare-github-btn'));

        await waitFor(() => {
            expect(statusSpy).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('syncing');
        });

        // Upload asset in table
        const uploadInput = screen.getByLabelText(/Upload file for fabric-api.jar/i) as HTMLInputElement;
        const fakeFile = new File(['content'], 'fabric-api.jar', { type: 'application/java-archive' });
        await user.upload(uploadInput, fakeFile);

        await waitFor(() => {
            expect(statusSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
        });
    });

    // ==========================================
    // 11. PREPARE Y CHECK TIENEN INDICADORES INDEPENDIENTES
    // ==========================================
    test('11. Prepare and Check have independent loading indicators', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        let resolveCheck: ((res: GitHubReleaseStatusResponse) => void) | undefined;
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockImplementation(() => {
            return new Promise((resolve) => {
                resolveCheck = resolve;
            });
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
        await user.click(screen.getByTestId('check-github-status-btn'));

        // Check is loading, Prepare is NOT preparing
        expect(screen.getByTestId('github-checking-loading')).toBeDefined();
        expect(screen.queryByTestId('github-preparing-loading')).toBeNull();

        const prepareBtn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
        const checkBtn = screen.getByTestId('check-github-status-btn') as HTMLButtonElement;

        expect(checkBtn.textContent).toContain('Checking...');
        expect(prepareBtn.textContent).toContain('Prepare GitHub Release');

        resolveCheck?.(mockGitHubStatusReady);

        await waitFor(() => {
            expect(screen.queryByTestId('github-checking-loading')).toBeNull();
        });
    });

    // ==========================================
    // 12. EXPECTED ASSETS, DOWNLOAD URL Y UNEXPECTED ASSETS VACÍO
    // ==========================================
    test('12. Renders expected assets count/names, download URLs, and empty unexpected assets notice', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockResolvedValue(mockPrepareResponse);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

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
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
            const btn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        await user.click(screen.getByTestId('prepare-github-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('prepare-success-alert')).toBeDefined();
        });

        const expectedAssetsBox = screen.getByTestId('expected-assets-info');
        expect(expectedAssetsBox.textContent).toContain('Expected Assets (1):');
        expect(expectedAssetsBox.textContent).toContain('fabric-api.jar');

        expect(screen.getByTestId('download-url-file-mod-1')).toBeDefined();
        expect(screen.getByText('https://github.com/releases/download/v1.0.0/fabric-api.jar')).toBeDefined();
        expect(screen.getByTestId('no-unexpected-assets')).toBeDefined();
        expect(screen.getByText(/No unexpected assets found on GitHub/i)).toBeDefined();
    });

    // ==========================================
    // 13. ESTADOS READ-ONLY PARA PUBLISHED / DEPRECATED
    // ==========================================
    test('13. Workspace for published/deprecated release displays read-only banner and hides prepare/publish controls', async () => {
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
            expect(screen.getByTestId('view-modpack-modpack-dep-1')).toBeDefined();
        });

        // View Published
        await user.click(screen.getByTestId('view-modpack-modpack-pub-1'));

        await waitFor(() => {
            expect(screen.getByTestId('already-published-alert')).toBeDefined();
            expect(screen.queryByTestId('prepare-github-btn')).toBeNull();
            expect(screen.queryByTestId('publish-controls')).toBeNull();
        });

        // View Deprecated
        await user.click(screen.getByTestId('view-modpack-modpack-dep-1'));

        await waitFor(() => {
            expect(screen.getByTestId('already-deprecated-alert')).toBeDefined();
            expect(screen.queryByTestId('prepare-github-btn')).toBeNull();
            expect(screen.queryByTestId('publish-controls')).toBeNull();
        });
    });

    // ==========================================
    // 14. NAVEGACIÓN Y URL SE MANTIENEN EN /MODPACK
    // ==========================================
    test('14. URL continuously remains /modpack throughout all interactions without navigating away', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockResolvedValue(mockPrepareResponse);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);
        vi.spyOn(ReleasesApi, 'publishRelease').mockResolvedValue({ status: 'published' });
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue({
            ...mockModpackDraft1,
            status: 'published'
        });

        let currentPath = '';
        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <LocationTracker onLocation={(p) => (currentPath = p)} />
                <Routes>
                    <Route path="/modpack" element={<ModpackPage />} />
                    <Route path="/releases/:id" element={<div>Releases Detail Page</div>} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        // 1. Select Draft
        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await waitFor(() => {
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
            const prepareBtn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
            expect(prepareBtn.disabled).toBe(false);
        });
        expect(currentPath).toBe('/modpack');

        // 2. Prepare GitHub
        await user.click(screen.getByTestId('prepare-github-btn'));
        await waitFor(() => {
            expect(screen.getByTestId('prepare-success-alert')).toBeDefined();
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
            const publishBtn = screen.getByTestId('publish-release-btn') as HTMLButtonElement;
            expect(publishBtn.disabled).toBe(false);
        });
        expect(currentPath).toBe('/modpack');

        // 3. Publish
        await user.type(screen.getByTestId('confirm-version-input'), '1.0.0');
        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('publish-success-alert')).toBeDefined();
        });
        expect(currentPath).toBe('/modpack');
    });

    // ==========================================
    // 15. PREPARE LLAMA A LA API Y MUESTRA TAG E ID
    // ==========================================
    test('15. Prepare calls prepareGitHubRelease(releaseId) exactly and renders github_tag and github_release_id', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        const prepareSpy = vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockResolvedValue({
            github_tag: 'v1.0.0-modpack',
            github_release_id: 12345678,
            expectedAssets: []
        });
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

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
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
            const btn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        await user.click(screen.getByTestId('prepare-github-btn'));

        await waitFor(() => {
            expect(prepareSpy).toHaveBeenCalledTimes(1);
            expect(prepareSpy).toHaveBeenCalledWith('modpack-draft-1');
            const alert = screen.getByTestId('prepare-success-alert');
            expect(alert.textContent).toContain('v1.0.0-modpack');
            expect(alert.textContent).toContain('12345678');
        });
    });

    // ==========================================
    // 16. ERROR DE PREPARE APARECE EN PREPAREERROR SIN AFECTAR CHECK
    // ==========================================
    test('16. Prepare error appears in prepareError alert without triggering or displaying check error', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockRejectedValue(new Error('GitHub tag collision'));
        const checkStatusSpy = vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus');

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
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
            const btn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        await user.click(screen.getByTestId('prepare-github-btn'));

        await waitFor(() => {
            const errorAlert = screen.getByTestId('prepare-error-alert');
            expect(errorAlert.textContent).toContain('GitHub tag collision');
            expect(screen.queryByTestId('github-error-alert')).toBeNull();
            expect(checkStatusSpy).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // 17. ERROR DE CHECK APARECE EN GITHUBSTATUSERROR SIN BORRAR PREPARE EXITOSO
    // ==========================================
    test('17. Check error appears in githubStatusError without clearing successful prepareResult alert', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);

        vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockResolvedValue(mockPrepareResponse);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus')
            .mockResolvedValueOnce(mockGitHubStatusReady)
            .mockRejectedValueOnce(new Error('GitHub API rate limited'));

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
            expect(screen.getByText('Workspace: v1.0.0')).toBeDefined();
            const btn = screen.getByTestId('prepare-github-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });

        // 1. Prepare succeeds
        await user.click(screen.getByTestId('prepare-github-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('prepare-success-alert')).toBeDefined();
        });

        // 2. Subsequent manual Check fails
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-error-alert')).toBeDefined();
            expect(screen.getByTestId('github-error-alert').textContent).toContain('GitHub API rate limited');
            expect(screen.getByTestId('prepare-success-alert')).toBeDefined();
        });
    });

    // ==========================================
    // 18. TABLA MUESTRA READY, ASSET_NOT_UPLOADED, DIGEST_MISMATCH Y UNEXPECTED ASSETS
    // ==========================================
    test('18. Renders ready, asset_not_uploaded, digest_mismatch badges and non-empty unexpected assets list', async () => {
        const user = userEvent.setup();
        const filesWithThree: ReleaseFile[] = [
            {
                id: 'file-1',
                release_id: 'modpack-draft-1',
                path: 'mods/file1.jar',
                logical_path: 'mods/file1.jar',
                filename: 'file1.jar',
                operation: 'add',
                size: 1024,
                sha256: 'a'.repeat(64),
                created_at: '2026-08-21T00:00:00Z'
            },
            {
                id: 'file-2',
                release_id: 'modpack-draft-1',
                path: 'mods/file2.jar',
                logical_path: 'mods/file2.jar',
                filename: 'file2.jar',
                operation: 'add',
                size: 2048,
                sha256: 'b'.repeat(64),
                created_at: '2026-08-21T00:00:00Z'
            },
            {
                id: 'file-3',
                release_id: 'modpack-draft-1',
                path: 'mods/file3.jar',
                logical_path: 'mods/file3.jar',
                filename: 'file3.jar',
                operation: 'add',
                size: 4096,
                sha256: 'c'.repeat(64),
                created_at: '2026-08-21T00:00:00Z'
            }
        ];

        const mockMultiStatus: GitHubReleaseStatusResponse = {
            status: 'syncing',
            assetStatuses: {
                'file-1': { status: 'ready', github_asset_id: 101, download_url: 'https://example.com/file1.jar' },
                'file-2': { status: 'asset_not_uploaded' },
                'file-3': { status: 'digest_mismatch', github_asset_id: 103 }
            },
            unexpectedAssets: [
                { id: 991, name: 'untracked-asset.zip' },
                { id: 992, name: 'old-backup.tar.gz' }
            ]
        };

        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: filesWithThree, Count: 3 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockMultiStatus);

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-asset-status-file-1').textContent).toBe('ready');
            expect(screen.getByTestId('github-asset-status-file-2').textContent).toBe('asset_not_uploaded');
            expect(screen.getByTestId('github-asset-status-file-3').textContent).toBe('digest_mismatch');

            const unexpectedAlert = screen.getByTestId('unexpected-assets-alert');
            expect(unexpectedAlert.textContent).toContain('untracked-asset.zip (ID: 991)');
            expect(unexpectedAlert.textContent).toContain('old-backup.tar.gz (ID: 992)');
        });
    });

    // ==========================================
    // 19. PUBLISH PENDIENTE MUESTRA PUBLISHING..., DESHABILITA CONTROLES Y PREVIENE DOBLE CLIC
    // ==========================================
    test('19. Pending publish shows Publishing..., disables controls, and rapid double click triggers only one API call', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

        let resolvePublish: ((res: { status: string }) => void) | undefined;
        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease').mockImplementation(() => {
            return new Promise((resolve) => {
                resolvePublish = resolve;
            });
        });

        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue({
            ...mockModpackDraft1,
            status: 'published'
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
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
            const publishBtn = screen.getByTestId('publish-release-btn') as HTMLButtonElement;
            expect(publishBtn.disabled).toBe(false);
        });

        const confirmInput = screen.getByTestId('confirm-version-input');
        await user.type(confirmInput, '1.0.0');

        const publishBtn = screen.getByTestId('publish-release-btn') as HTMLButtonElement;

        // Click first time
        await user.click(publishBtn);

        // Immediate state verification
        expect(publishBtn.textContent).toContain('Publishing...');
        expect(publishBtn.disabled).toBe(true);

        // Rapid second click attempt while pending
        await user.click(publishBtn);

        expect(publishSpy).toHaveBeenCalledTimes(1);

        // Resolve publish
        resolvePublish?.({ status: 'published' });

        await waitFor(() => {
            expect(screen.getByTestId('publish-success-alert')).toBeDefined();
            expect(publishSpy).toHaveBeenCalledTimes(1);
        });
    });

    // ==========================================
    // 20. ERROR DE PUBLISH PERMANECE VISIBLE, NO MUESTRA ÉXITO Y MANTIENE EL DRAFT EDITABLE
    // ==========================================
    test('20. publishRelease error remains visible, does not show success, and preserves draft editable state', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValue({ value: [mockModpackDraft1], Count: 1 });
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);

        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease').mockRejectedValue(new Error('Publish transaction failed: network timeout'));

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
            const publishBtn = screen.getByTestId('publish-release-btn') as HTMLButtonElement;
            expect(publishBtn.disabled).toBe(false);
        });

        const confirmInput = screen.getByTestId('confirm-version-input');
        await user.type(confirmInput, '1.0.0');

        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(publishSpy).toHaveBeenCalledWith('modpack-draft-1', '1.0.0');
            const errorAlert = screen.getByTestId('publish-error-alert');
            expect(errorAlert.textContent).toContain('Publish transaction failed: network timeout');
            expect(screen.queryByTestId('publish-success-alert')).toBeNull();
            // Draft controls and add file form remain present and not read-only
            expect(screen.queryByTestId('already-published-alert')).toBeNull();
            expect(screen.getByTestId('publish-controls')).toBeDefined();
            expect(screen.getByTestId('local-file-inspect')).toBeDefined();
        });
    });

    // ==========================================
    // 21. PUBLISH EXITOSO VUELVE A CARGAR LA LISTA DE RELEASES
    // ==========================================
    test('21. Successful publish reloads the releases list via listReleases', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(ReleasesApi, 'listReleases')
            .mockResolvedValueOnce({ value: [mockModpackDraft1], Count: 1 })
            .mockResolvedValueOnce({ value: [{ ...mockModpackDraft1, status: 'published' }], Count: 1 });

        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockFilesDraft, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue(mockValidationValid);
        vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValue(mockGitHubStatusReady);
        vi.spyOn(ReleasesApi, 'publishRelease').mockResolvedValue({ status: 'published' });
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue({
            ...mockModpackDraft1,
            status: 'published'
        });

        render(
            <MemoryRouter initialEntries={['/modpack']}>
                <ModpackPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('configure-modpack-modpack-draft-1')).toBeDefined();
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        await user.click(screen.getByTestId('configure-modpack-modpack-draft-1'));
        await user.click(screen.getByTestId('check-github-status-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('github-sync-badge').textContent).toBe('ready');
        });

        await user.type(screen.getByTestId('confirm-version-input'), '1.0.0');
        await user.click(screen.getByTestId('publish-release-btn'));

        await waitFor(() => {
            expect(screen.getByTestId('publish-success-alert')).toBeDefined();
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByTestId('stat-published').textContent).toContain('1');
            expect(screen.getByTestId('stat-drafts').textContent).toContain('0');
        });
    });
});
