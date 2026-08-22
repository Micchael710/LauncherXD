import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReleaseDetailPage } from '../pages/ReleaseDetailPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import type { Release } from '../types/releases';
import type { ReleaseFile } from '../types/releaseFiles';

describe('Release Detail Unified Single-Page UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockDraftRelease: Release = {
        id: 'rel-unified-1',
        version: '3.0.0',
        channel: 'stable',
        release_type: 'launcher',
        status: 'draft',
        total_size: 4096,
        release_notes: 'Unified single-page notes',
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z'
    };

    const mockFile: ReleaseFile = {
        id: 'file-unified-1',
        release_id: 'rel-unified-1',
        path: 'client/launcher.exe',
        logical_path: 'client/launcher.exe',
        filename: 'launcher.exe',
        operation: 'add',
        size: 4096,
        sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        created_at: '2026-08-20T00:00:00Z'
    };

    test('1. renders all five essential sections simultaneously in a single DOM render without tabs', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-unified-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Release Details: 3.0.0')).toBeDefined();
        });

        // 1. Release Metadata
        expect(screen.getByText('Release Metadata')).toBeDefined();
        expect(screen.getByText('Unified single-page notes')).toBeDefined();

        // 2. Release Files
        expect(screen.getByRole('heading', { name: 'Release Files' })).toBeDefined();
        expect(screen.getAllByText('client/launcher.exe').length).toBe(2);

        // 3. Release Readiness & Validation
        expect(screen.getByRole('heading', { name: 'Release Readiness & Validation' })).toBeDefined();
        expect(screen.getByText('✓ Release is valid and ready for publishing.')).toBeDefined();

        // 4. GitHub Release & Assets Status
        expect(screen.getByText('GitHub Release & Assets Status')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Check Status' })).toBeDefined();

        // 5. Publish Release
        const publishElements = screen.getAllByText('Publish Release');
        expect(publishElements.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: 'Publish Release' })).toBeDefined();

        // Verify NO tab navigation elements exist
        expect(screen.queryByRole('tablist')).toBeNull();
        expect(screen.queryByRole('tab')).toBeNull();
        expect(document.querySelector('.tabs-nav')).toBeNull();
        expect(document.querySelector('.tab-button')).toBeNull();
    });

    test('2. "Prepare GitHub Draft" executes prepare API and refreshes status', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        const prepareSpy = vi.spyOn(ReleasesApi, 'prepareGitHubRelease').mockResolvedValueOnce({
            github_tag: 'v3.0.0',
            github_release_id: 998877,
            expectedAssets: [{ fileId: 'file-unified-1', name: 'launcher.exe' }]
        });

        const statusSpy = vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValueOnce({
            status: 'syncing',
            assetStatuses: {
                'file-unified-1': { status: 'asset_not_uploaded' }
            },
            unexpectedAssets: []
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-unified-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Prepare GitHub Draft' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Prepare GitHub Draft' }));

        expect(prepareSpy).toHaveBeenCalledWith('rel-unified-1');
        await waitFor(() => {
            expect(statusSpy).toHaveBeenCalledWith('rel-unified-1');
            expect(screen.getByText(/Draft release prepared on GitHub!/i)).toBeDefined();
            expect(screen.getByText('v3.0.0')).toBeDefined();
        });
    });

    test('3. "Check Status" queries GitHub release status without tab switching', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        const statusSpy = vi.spyOn(ReleasesApi, 'getGitHubReleaseStatus').mockResolvedValueOnce({
            status: 'ready',
            assetStatuses: {
                'file-unified-1': { status: 'ready', github_asset_id: 12345 }
            },
            unexpectedAssets: []
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-unified-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Check Status' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Check Status' }));

        expect(statusSpy).toHaveBeenCalledWith('rel-unified-1');
        await waitFor(() => {
            expect(screen.getByText('Synchronization State:')).toBeDefined();
            expect(screen.getByText('#12345')).toBeDefined();
        });
    });

    test('4. publish confirmation enforces version matching and displays success banner', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const publishSpy = vi.spyOn(ReleasesApi, 'publishRelease').mockResolvedValueOnce({
            status: 'published'
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-unified-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Publish Release' })).toBeDefined();
        });

        const publishBtn = screen.getByRole('button', { name: 'Publish Release' }) as HTMLButtonElement;
        const confirmInput = screen.getByPlaceholderText('3.0.0') as HTMLInputElement;

        // Button disabled when empty
        expect(publishBtn.disabled).toBe(true);

        // Mismatched version keeps button disabled
        await user.type(confirmInput, '2.9.9');
        expect(publishBtn.disabled).toBe(true);

        // Matching version enables button
        await user.clear(confirmInput);
        await user.type(confirmInput, '3.0.0');
        expect(publishBtn.disabled).toBe(false);

        await user.click(publishBtn);

        expect(publishSpy).toHaveBeenCalledWith('rel-unified-1', '3.0.0');
        await waitFor(() => {
            expect(screen.getByText('✓ Release published successfully!')).toBeDefined();
        });
    });

    test('5. verified=false does NOT display "Upload verified" badge', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockResolvedValueOnce({
            status: 'ok',
            verified: false,
            warning: 'UPLOAD_NOT_VERIFIED',
            asset: { id: 888, name: 'launcher.exe' }
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-unified-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('upload-btn-file-unified-1')).toBeDefined();
        });

        const fileInput = screen.getByLabelText(/Upload file for launcher.exe/i) as HTMLInputElement;
        const fakeFile = new File(['dummy binary'], 'launcher.exe', { type: 'application/octet-stream' });

        await user.upload(fileInput, fakeFile);

        await waitFor(() => {
            expect(screen.getByText('Upload completed — verification pending')).toBeDefined();
        });

        // Ensure "Upload verified" is NOT displayed
        expect(screen.queryByText('✓ Upload verified')).toBeNull();
    });
});
