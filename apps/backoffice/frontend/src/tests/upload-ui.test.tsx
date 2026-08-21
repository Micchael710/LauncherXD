import { test, expect, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReleaseDetailPage } from '../pages/ReleaseDetailPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import type { Release } from '../types/releases';
import type { ReleaseFile, UploadProgress } from '../types/releaseFiles';
import { ApiClientError } from '../api/client';

describe('Physical Asset Upload UI Functional Tests', () => {
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
    };

    const mockStandaloneFiles: ReleaseFile[] = [
        {
            id: 'file-add-1',
            release_id: 'rel-draft-1',
            path: 'mods/sodium.jar',
            logical_path: 'mods/sodium.jar',
            filename: 'sodium.jar',
            operation: 'add',
            size: 4096,
            sha256: 'a'.repeat(64),
            created_at: '2026-01-01T00:00:00Z'
        },
        {
            id: 'file-del-1',
            release_id: 'rel-draft-1',
            path: 'mods/old.jar',
            logical_path: 'mods/old.jar',
            filename: 'old.jar',
            operation: 'delete',
            size: 0,
            sha256: undefined,
            created_at: '2026-01-01T00:00:00Z'
        }
    ];

    const mockMultipartFiles: ReleaseFile[] = [
        {
            id: 'part-1',
            release_id: 'rel-draft-1',
            path: 'package.part01',
            logical_path: 'package.zip',
            filename: 'package.part01',
            operation: 'add',
            size: 1024,
            sha256: 'b'.repeat(64),
            part_index: 1,
            part_count: 2,
            final_sha256: 'f'.repeat(64),
            created_at: '2026-01-01T00:00:00Z'
        },
        {
            id: 'part-2',
            release_id: 'rel-draft-1',
            path: 'package.part02',
            logical_path: 'package.zip',
            filename: 'package.part02',
            operation: 'add',
            size: 1024,
            sha256: 'c'.repeat(64),
            part_index: 2,
            part_count: 2,
            final_sha256: 'f'.repeat(64),
            created_at: '2026-01-01T00:00:00Z'
        }
    ];

    test('1. Delete operation shows "No upload required" and no upload button, add operation shows Upload Asset', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockStandaloneFiles, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('No upload required')).toBeDefined();
            expect(screen.getByTestId('upload-btn-file-add-1')).toBeDefined();
            expect(screen.queryByTestId('upload-btn-file-del-1')).toBeNull();
        });
    });

    test('2. Successful file upload displays progress, verifying state, and verified badge', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFiles[0]], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        let progressCb: ((p: UploadProgress) => void) | undefined;
        let resolveUpload: (() => void) | undefined;

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockImplementationOnce((_relId, _fileId, _file, onProgress) => {
            progressCb = onProgress;
            return new Promise((resolve) => {
                resolveUpload = () => resolve({
                    status: 'ok',
                    verified: true,
                    asset: { id: 999, name: 'lx-test-sodium.jar' }
                });
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
            expect(screen.getByTestId('upload-btn-file-add-1')).toBeDefined();
        });

        const fileInput = screen.getByLabelText(/Upload file for sodium.jar/i) as HTMLInputElement;
        const fakeFile = new File(['sodium binary content'], 'sodium.jar', { type: 'application/java-archive' });

        await user.upload(fileInput, fakeFile);

        expect(progressCb).toBeDefined();

        // 1. Simulate 45% progress
        act(() => {
            progressCb?.({ loaded: 1843, total: 4096, percent: 45 });
        });
        await waitFor(() => {
            expect(screen.getByText(/Uploading: 45%/i)).toBeDefined();
        });

        // 2. Simulate 100% progress -> Verifying
        act(() => {
            progressCb?.({ loaded: 4096, total: 4096, percent: 100 });
        });
        await waitFor(() => {
            expect(screen.getByText(/100% — Verifying with GitHub.../i)).toBeDefined();
        });

        // 3. Resolve upload as verified
        act(() => {
            resolveUpload?.();
        });
        await waitFor(() => {
            expect(screen.getByTestId('upload-ready-file-add-1')).toBeDefined();
            expect(screen.getByText('✓ Upload verified')).toBeDefined();
        });
    });

    test('3. Upload error displays structured error message and Retry Upload button', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFiles[0]], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockRejectedValueOnce(
            new ApiClientError(400, 'FILE_SIZE_MISMATCH', [], 'File size (100 B) does not match expected size (4096 B)')
        );

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('upload-btn-file-add-1')).toBeDefined();
        });

        const fileInput = screen.getByLabelText(/Upload file for sodium.jar/i) as HTMLInputElement;
        const fakeFile = new File(['small'], 'sodium.jar');

        await user.upload(fileInput, fakeFile);

        await waitFor(() => {
            expect(screen.getByText(/File size \(100 B\) does not match expected size \(4096 B\)/i)).toBeDefined();
            expect(screen.getByRole('button', { name: /Retry Upload/i })).toBeDefined();
        });
    });

    test('4. Displays GITHUB_AUTH_NOT_CONFIGURED friendly error', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockStandaloneFiles[0]], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockRejectedValueOnce(
            new ApiClientError(401, 'GITHUB_AUTH_NOT_CONFIGURED', [], 'GitHub upload credentials are not configured')
        );

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('upload-btn-file-add-1')).toBeDefined();
        });

        const fileInput = screen.getByLabelText(/Upload file for sodium.jar/i) as HTMLInputElement;
        const fakeFile = new File(['content'], 'sodium.jar');

        await user.upload(fileInput, fakeFile);

        await waitFor(() => {
            expect(screen.getByText(/GitHub upload credentials are not configured/i)).toBeDefined();
        });
    });

    test('5. Multipart parts upload independently and show Multipart assets ready when complete', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: mockMultipartFiles, Count: 2 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset')
            .mockResolvedValueOnce({ status: 'ok', verified: true, asset: { id: 1, name: 'part1' } })
            .mockResolvedValueOnce({ status: 'ok', verified: true, asset: { id: 2, name: 'part2' } });

        render(
            <MemoryRouter initialEntries={['/releases/rel-draft-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('upload-btn-part-1')).toBeDefined();
            expect(screen.getByTestId('upload-btn-part-2')).toBeDefined();
        });

        const input1 = screen.getByLabelText(/Upload file for package.part01/i) as HTMLInputElement;
        await user.upload(input1, new File(['part1 content'], 'package.part01'));

        await waitFor(() => {
            expect(screen.getByTestId('upload-ready-part-1')).toBeDefined();
            expect(screen.queryByText('✓ Multipart assets ready')).toBeNull();
        });

        const input2 = screen.getByLabelText(/Upload file for package.part02/i) as HTMLInputElement;
        await user.upload(input2, new File(['part2 content'], 'package.part02'));

        await waitFor(() => {
            expect(screen.getByTestId('upload-ready-part-2')).toBeDefined();
            expect(screen.getByText('✓ Multipart assets ready')).toBeDefined();
        });
    });
});
