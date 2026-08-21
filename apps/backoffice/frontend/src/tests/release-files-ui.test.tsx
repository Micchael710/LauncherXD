import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReleaseDetailPage } from '../pages/ReleaseDetailPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { InspectApi } from '../api/inspect';
import type { FileInspectResult } from '../api/inspect';
import { ApiClientError } from '../api/client';
import type { Release } from '../types/releases';
import type { ReleaseFile } from '../types/releaseFiles';

describe('Release Files & Readiness UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockDraftRelease: Release = {
        id: 'rel-draft-1',
        version: '1.0.0',
        channel: 'stable',
        release_type: 'launcher',
        status: 'draft',
        total_size: 1024,
        release_notes: 'Draft notes',
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z'
    };

    const mockPublishedRelease: Release = {
        id: 'rel-pub-1',
        version: '2.0.0',
        channel: 'stable',
        release_type: 'launcher',
        status: 'published',
        total_size: 2048,
        release_notes: 'Published notes',
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z'
    };

    const mockDeprecatedRelease: Release = {
        id: 'rel-dep-1',
        version: '0.9.0',
        channel: 'beta',
        release_type: 'launcher',
        status: 'deprecated',
        total_size: 512,
        release_notes: 'Deprecated notes',
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z'
    };

    const mockFullSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0';
    const mockFullFinalSha = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

    const mockStandaloneFile: ReleaseFile = {
        id: 'file-1',
        release_id: 'rel-draft-1',
        path: 'bin/launcher.jar',
        logical_path: 'bin/launcher.jar',
        filename: 'launcher.jar',
        operation: 'add',
        size: 2048,
        sha256: mockFullSha,
        created_at: '2026-08-20T00:00:00Z'
    };

    const mockMultipartParts: ReleaseFile[] = [
        {
            id: 'part-1',
            release_id: 'rel-draft-1',
            path: 'bigfile.zip.001',
            logical_path: 'bigfile.zip',
            filename: 'bigfile.zip.001',
            operation: 'add',
            size: 1000,
            sha256: mockFullSha,
            part_index: 1,
            part_count: 2,
            final_sha256: mockFullFinalSha,
            created_at: '2026-08-20T00:00:00Z'
        },
        {
            id: 'part-2',
            release_id: 'rel-draft-1',
            path: 'bigfile.zip.002',
            logical_path: 'bigfile.zip',
            filename: 'bigfile.zip.002',
            operation: 'add',
            size: 1000,
            sha256: mockFullSha,
            part_index: 2,
            part_count: 2,
            final_sha256: mockFullFinalSha,
            created_at: '2026-08-20T00:00:00Z'
        }
    ];

    test('1. Draft release shows Add form, Edit and Delete buttons on files', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Release Details: 1.0.0')).toBeDefined();
            expect(screen.getAllByText('bin/launcher.jar').length).toBe(2);
            expect(screen.getByRole('button', { name: 'Edit launcher.jar' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Delete launcher.jar' })).toBeDefined();
            expect(screen.getByRole('heading', { name: 'Add Release File' })).toBeDefined();
        });
    });

    test('2. Published release does NOT show write controls (no Add, Edit, Delete)', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockPublishedRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-pub-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Release Details: 2.0.0')).toBeDefined();
            expect(screen.getAllByText('bin/launcher.jar').length).toBe(2);
        });

        expect(screen.queryByRole('heading', { name: 'Add Release File' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit launcher.jar' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete launcher.jar' })).toBeNull();
    });

    test('3. Deprecated release does NOT show write controls', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDeprecatedRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-dep-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Release Details: 0.9.0')).toBeDefined();
            expect(screen.getAllByText('bin/launcher.jar').length).toBe(2);
        });

        expect(screen.queryByRole('heading', { name: 'Add Release File' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit launcher.jar' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete launcher.jar' })).toBeNull();
    });

    test('4. Edit opens form prefilled with current values', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher.jar' }));

        expect(screen.getByRole('heading', { name: 'Edit Release File: launcher.jar' })).toBeDefined();
        expect((screen.getByLabelText(/^Path/i) as HTMLInputElement).value).toBe('bin/launcher.jar');
        expect((screen.getByLabelText(/Logical Path/i) as HTMLInputElement).value).toBe('bin/launcher.jar');
        expect((screen.getByLabelText(/Size \(bytes\)/i) as HTMLInputElement).value).toBe('2048');
        expect((screen.getByLabelText(/^SHA-256/i) as HTMLInputElement).value).toBe(mockFullSha);
        expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined();
    });

    test('5. PATCH sends strictly partial payload when only size is changed (no filename, no unmodified fields)', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const updateSpy = vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher.jar' }));

        const sizeInput = screen.getByLabelText(/Size \(bytes\)/i);
        await user.clear(sizeInput);
        await user.type(sizeInput, '4096');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith('rel-draft-1', 'file-1', {
            size: 4096
        });

        const payload = updateSpy.mock.calls[0][2] as unknown as Record<string, unknown>;
        expect(payload).toEqual({ size: 4096 });
        expect(payload.path).toBeUndefined();
        expect(payload.logical_path).toBeUndefined();
        expect(payload.operation).toBeUndefined();
        expect(payload.sha256).toBeUndefined();
        expect(payload.filename).toBeUndefined();
    });

    test('5b. PATCH sends only path when changing path and never sends filename', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const updateSpy = vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher.jar' }));

        const pathInput = screen.getByLabelText(/^Path/i);
        await user.clear(pathInput);
        await user.type(pathInput, 'bin/new-launcher.jar');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith('rel-draft-1', 'file-1', {
            path: 'bin/new-launcher.jar'
        });
        const payload = updateSpy.mock.calls[0][2] as unknown as Record<string, unknown>;
        expect(payload.filename).toBeUndefined();
    });

    test('6. Successful PATCH closes edit mode and reloads files list and readiness', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        const listSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher.jar' }));
        const sizeInput = screen.getByLabelText(/Size \(bytes\)/i);
        await user.clear(sizeInput);
        await user.type(sizeInput, '4096');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /edit release file/i })).toBeNull();
            expect(screen.getByRole('heading', { name: 'Add Release File' })).toBeDefined();
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
        });
    });

    test('7. PATCH with structured validation error displays error banner visibly without alert', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockRejectedValueOnce(
            new ApiClientError(400, 'validation_error', [
                { code: 'invalid_path', path: '../unsafe.jar', message: 'Path traversal forbidden' }
            ])
        );

        const alertSpy = vi.spyOn(window, 'alert');

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit launcher.jar' }));
        const pathInput = screen.getByLabelText(/^Path/i);
        await user.clear(pathInput);
        await user.type(pathInput, '../unsafe.jar');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText(/Validation error: Invalid path \(path: \.\.\/unsafe\.jar, message: Path traversal forbidden\)/i)).toBeDefined();
            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    test('7b. Edit mode prevents clearing existing optional fields and displays visible guidance without calling API', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [mockMultipartParts[0]], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        const updateSpy = vi.spyOn(ReleaseFilesApi, 'updateReleaseFile');

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit bigfile.zip.001' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit bigfile.zip.001' }));

        // Attempt to clear final_sha256 which existed
        const finalShaInput = screen.getByLabelText(/Final SHA-256/i);
        await user.clear(finalShaInput);

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/The current API does not allow clearing final SHA-256 on edit/i)).toBeDefined();
        expect(updateSpy).not.toHaveBeenCalled();
    });

    test('8. Canceling delete confirmation does NOT call DELETE API', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const deleteSpy = vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile');
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Delete launcher.jar' }));

        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete file "bin/launcher.jar"?');
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    test('9. Confirming delete calls API with exact releaseId and fileId', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const deleteSpy = vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile').mockResolvedValueOnce({ status: 'ok' });
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Delete launcher.jar' }));

        expect(deleteSpy).toHaveBeenCalledWith('rel-draft-1', 'file-1');
    });

    test('10. DELETE in progress disables action, and re-enables with "Delete" on resolution', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        let resolveDelete: ((res: { status: 'ok' }) => void) | undefined;
        vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveDelete = resolve;
            });
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete launcher.jar' })).toBeDefined();
        });

        const deleteBtn = screen.getByRole('button', { name: 'Delete launcher.jar' });
        await user.click(deleteBtn);

        expect(deleteBtn.textContent).toBe('Deleting...');
        expect(deleteBtn.hasAttribute('disabled')).toBe(true);

        resolveDelete?.({ status: 'ok' });

        await waitFor(() => {
            const resolvedBtn = screen.getByRole('button', { name: 'Delete launcher.jar' });
            expect(resolvedBtn.textContent).toBe('Delete');
            expect(resolvedBtn.hasAttribute('disabled')).toBe(false);
        });
    });

    test('11. Successful DELETE reloads files list and readiness', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        const listSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles')
            .mockResolvedValueOnce({ value: [mockStandaloneFile], Count: 1 })
            .mockResolvedValueOnce({ value: [], Count: 0 });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile').mockResolvedValueOnce({ status: 'ok' });
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Delete launcher.jar' }));

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByText('No release files found.')).toBeDefined();
        });
    });

    test('12. DELETE error displays visible message without alert', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile').mockRejectedValueOnce(
            new ApiClientError(409, 'conflict', ['only_drafts_can_be_deleted'])
        );
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const alertSpy = vi.spyOn(window, 'alert');

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete launcher.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Delete launcher.jar' }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText(/Only draft releases can be deleted/i)).toBeDefined();
            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    test('13. Multipart complete group is rendered as Complete with full final hash', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: mockMultipartParts, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Logical Path: bigfile.zip')).toBeDefined();
            expect(screen.getByText('✓ Complete')).toBeDefined();
            expect(screen.getByText('Parts: 2 / 2')).toBeDefined();
            expect(screen.getByText(mockFullFinalSha)).toBeDefined();
        });
    });

    test('14. Multipart incomplete group displays missing indices warning', async () => {
        const incompleteParts = [mockMultipartParts[0]]; // Only part 1 of 2
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: incompleteParts, Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: false, issues: [{ code: 'multipart_missing_part' }] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Logical Path: bigfile.zip')).toBeDefined();
            expect(screen.getByText('⚠️ Incomplete')).toBeDefined();
            expect(screen.getByText('Missing part indices: 2')).toBeDefined();
        });
    });

    test('15. Multipart group with duplicates or inconsistencies displays diagnostics', async () => {
        const inconsistentParts: ReleaseFile[] = [
            mockMultipartParts[0],
            { ...mockMultipartParts[0], id: 'dup-1', path: 'bigfile.zip.001.dup' }
        ];

        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: inconsistentParts, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: false, issues: [{ code: 'duplicate_part_index' }] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Duplicate part indices: 1')).toBeDefined();
        });
    });

    test('15b. Multipart group with present vs absent final_sha256 displays diagnostic warning', async () => {
        const partialShaParts: ReleaseFile[] = [
            mockMultipartParts[0], // Has final_sha256
            { ...mockMultipartParts[1], final_sha256: undefined } // Missing final_sha256
        ];

        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: partialShaParts, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: false, issues: [{ code: 'inconsistent_final_sha256' }] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Inconsistent final SHA-256 across parts')).toBeDefined();
            expect(screen.getByText('⚠️ Incomplete')).toBeDefined();
        });
    });

    test('16. Individual parts inside a multipart group keep Edit/Delete action buttons in draft', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: mockMultipartParts, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit bigfile.zip.001' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Delete bigfile.zip.001' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit bigfile.zip.002' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Delete bigfile.zip.002' })).toBeDefined();
        });
    });

    test('17. Displays loading state for readiness validation while fetching', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockImplementation(() => new Promise(() => {}));

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('validation-loading')).toBeDefined();
            expect(screen.getByText('Loading validation status...')).toBeDefined();
        });
    });

    test('18. Displays valid readiness state when release is ready', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('✓ Release is valid and ready for publishing.')).toBeDefined();
        });
    });

    test('19. Displays invalid readiness state with code, path, and message', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValueOnce({
            valid: false,
            issues: [
                { code: 'multipart_missing_part', path: 'bin/pack.zip', message: 'Missing parts: 2' },
                { code: 'invalid_total_size', message: 'Calculated size does not match release total_size' }
            ]
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('⚠️ Release has validation issues:')).toBeDefined();
            expect(screen.getByText('multipart_missing_part')).toBeDefined();
            expect(screen.getByText(/Missing parts: 2/i)).toBeDefined();
            expect(screen.getByText('invalid_total_size')).toBeDefined();
        });
    });

    test('20. Displays error state when querying readiness validation fails', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockRejectedValueOnce(
            new ApiClientError(500, 'API_ERROR', [], 'Failed to fetch release validation status')
        );

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Failed to fetch release validation status')).toBeDefined();
        });
    });

    test('21. Local Inspector integration, FormData upload and non-overwriting paths', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        let resolveInspect: ((res: FileInspectResult) => void) | undefined;
        vi.spyOn(InspectApi, 'inspectLocalFile').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveInspect = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Add Release File' })).toBeDefined();
        });

        const fileInput = screen.getByLabelText(/Inspect local file/i) as HTMLInputElement;
        const submitBtn = screen.getByRole('button', { name: 'Add File' });
        const fakeFile = new File(['file contents'], 'mod.jar', { type: 'application/java-archive' });

        await user.upload(fileInput, fakeFile);

        expect(screen.getByText('Inspecting file...')).toBeDefined();
        expect(fileInput.hasAttribute('disabled')).toBe(true);
        expect(submitBtn.hasAttribute('disabled')).toBe(true);

        resolveInspect?.({
            filename: 'mod.jar',
            size: 8192,
            sha256: '9'.repeat(64)
        });

        await waitFor(() => {
            expect(screen.queryByText('Inspecting file...')).toBeNull();
            expect((screen.getByLabelText(/^Path/i) as HTMLInputElement).value).toBe('mod.jar');
            expect((screen.getByLabelText(/Logical Path/i) as HTMLInputElement).value).toBe('mod.jar');
            expect((screen.getByLabelText(/Size \(bytes\)/i) as HTMLInputElement).value).toBe('8192');
            expect((screen.getByLabelText(/^SHA-256/i) as HTMLInputElement).value).toBe('9'.repeat(64));
        });
    });

    test('22. Edit standalone Release File with null part_index, part_count, final_sha256 opens without crashing and saves PATCH', async () => {
        const user = userEvent.setup();
        const standaloneWithNulls: ReleaseFile = {
            id: 'file-nulls',
            release_id: 'rel-draft-1',
            path: 'sodium.jar',
            logical_path: 'sodium.jar',
            filename: 'sodium.jar',
            operation: 'add',
            size: 1024,
            sha256: mockFullSha,
            part_index: undefined,
            part_count: undefined,
            final_sha256: undefined,
            created_at: '2026-08-20T00:00:00Z'
        };

        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({
            value: [standaloneWithNulls],
            Count: 1
        });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });
        const updateSpy = vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockResolvedValue({
            status: 'ok'
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getAllByText('sodium.jar').length).toBeGreaterThan(0);
        });

        // Click Edit button in table
        const editBtn = screen.getByRole('button', { name: 'Edit sodium.jar' });
        await user.click(editBtn);

        // Verify edit form opens with populated data and NO blank screen
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Edit Release File: sodium.jar/i })).toBeDefined();
        });

        const pathInput = screen.getByLabelText(/^Path/i) as HTMLInputElement;
        const logicalPathInput = screen.getByLabelText(/Logical Path/i) as HTMLInputElement;
        const partIndexInput = screen.getByLabelText(/Part Index/i) as HTMLInputElement;
        const partCountInput = screen.getByLabelText(/Part Count/i) as HTMLInputElement;
        const finalShaInput = screen.getByLabelText(/Final SHA-256/i) as HTMLInputElement;

        expect(pathInput.value).toBe('sodium.jar');
        expect(logicalPathInput.value).toBe('sodium.jar');
        expect(partIndexInput.value).toBe('');
        expect(partCountInput.value).toBe('');
        expect(finalShaInput.value).toBe('');

        // Edit path and logical path
        await user.clear(pathInput);
        await user.type(pathInput, 'mods/sodium.jar');
        await user.clear(logicalPathInput);
        await user.type(logicalPathInput, 'mods/sodium.jar');

        const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
        await user.click(saveBtn);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith('rel-draft-1', 'file-nulls', {
                path: 'mods/sodium.jar',
                logical_path: 'mods/sodium.jar'
            });
        });

        // Verify filename was NOT sent in the payload
        const updateCallPayload = updateSpy.mock.calls[0][2];
        expect('filename' in updateCallPayload).toBe(false);
    });
});
