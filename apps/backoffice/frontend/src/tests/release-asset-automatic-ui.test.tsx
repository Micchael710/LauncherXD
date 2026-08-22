import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReleaseDetailPage } from '../pages/ReleaseDetailPage';
import { ReleasesApi } from '../api/releases';
import { ReleaseFilesApi } from '../api/releaseFiles';
import { ApiClientError } from '../api/client';
import type { Release } from '../types/releases';
import type { ReleaseFile, CreateReleaseFileInput } from '../types/releaseFiles';

describe('Automatic Release Asset Processing & Multipart Upload UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockDraftRelease: Release = {
        id: 'rel-auto-1',
        version: '4.0.0',
        channel: 'stable',
        release_type: 'launcher',
        status: 'draft',
        total_size: 0,
        release_notes: 'Automatic upload test',
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z'
    };

    const mockExistingFile: ReleaseFile = {
        id: 'file-existing-1',
        release_id: 'rel-auto-1',
        path: 'client/old.jar',
        logical_path: 'client/old.jar',
        filename: 'old.jar',
        operation: 'add',
        size: 1024,
        sha256: 'a'.repeat(64),
        created_at: '2026-08-20T00:00:00Z'
    };

    test('1. Creation mode does NOT render editable manual inputs for size, sha256, part_index, part_count, final_sha256', async () => {
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Add Release File' })).toBeDefined();
        });

        // Path and Logical Path are available
        expect(screen.getByLabelText(/^Path/i)).toBeDefined();
        expect(screen.getByLabelText(/Logical Path/i)).toBeDefined();
        expect(screen.getByLabelText(/Operation/i)).toBeDefined();

        // Manual technical inputs MUST NOT exist in creation mode
        expect(screen.queryByLabelText(/Size \(bytes\)/i)).toBeNull();
        expect(screen.queryByLabelText(/^SHA-256/i)).toBeNull();
        expect(screen.queryByLabelText(/Part Index/i)).toBeNull();
        expect(screen.queryByLabelText(/Part Count/i)).toBeNull();
        expect(screen.queryByLabelText(/Final SHA-256/i)).toBeNull();
    });

    test('2. Single asset (<= 1 GiB) auto-analyzes SHA-256, displays single plan summary, registers metadata and uploads', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        const listSpy = vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        const valSpy = vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const createSpy = vi.spyOn(ReleaseFilesApi, 'createReleaseFile').mockResolvedValue({
            id: 'file-single-1',
            status: 'created'
        });

        const uploadSpy = vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockResolvedValue({
            status: 'ok',
            verified: true,
            asset: { id: 101, name: 'optifine.jar' }
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('local-file-inspect')).toBeDefined();
        });

        // Exact 10 bytes: '1234567890' -> SHA-256: c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646
        const fakeFile = new File(['1234567890'], 'optifine.jar', { type: 'application/java-archive' });
        const fileInput = screen.getByTestId('local-file-inspect') as HTMLInputElement;

        await user.upload(fileInput, fakeFile);

        // Auto-fills paths
        await waitFor(() => {
            expect((screen.getByLabelText(/^Path/i) as HTMLInputElement).value).toBe('optifine.jar');
            expect((screen.getByLabelText(/Logical Path/i) as HTMLInputElement).value).toBe('optifine.jar');
            expect(screen.getByTestId('plan-type-badge')).toBeDefined();
            expect(screen.getByText('Single Asset (1 part)')).toBeDefined();
            expect(screen.getByTestId('plan-final-sha256').textContent).toBe('c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646');
        });

        // Submit form
        const submitBtn = screen.getByTestId('submit-asset-btn');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith('rel-auto-1', {
                path: 'optifine.jar',
                logical_path: 'optifine.jar',
                operation: 'add',
                size: 10,
                sha256: 'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646'
            });
            expect(uploadSpy).toHaveBeenCalledWith('rel-auto-1', 'file-single-1', expect.any(Blob), expect.any(Function));
            expect(screen.getByText(/All 1 parts registered, uploaded, and verified successfully!/i)).toBeDefined();
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(valSpy).toHaveBeenCalledTimes(2);
        });

        // Verify filename was NOT sent in createReleaseFile payload
        const sentPayload = createSpy.mock.calls[0][1] as CreateReleaseFileInput;
        expect('filename' in sentPayload).toBe(false);
    });

    test('3. Multipart (> 1 GiB equivalent) creates all metadata first, then uploads parts sequentially using real IDs', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        type GlobalEvent =
            | { type: 'create'; part_index: number; path: string; input: CreateReleaseFileInput }
            | { type: 'upload'; releaseId: string; fileId: string; blobSize: number; blobContent: string };

        const globalEvents: GlobalEvent[] = [];

        const createSpy = vi.spyOn(ReleaseFilesApi, 'createReleaseFile').mockImplementation(async (_relId, input) => {
            const partIdx = input.part_index ?? 1;
            globalEvents.push({
                type: 'create',
                part_index: partIdx,
                path: input.path,
                input
            });
            return {
                id: `id-part-${partIdx}`,
                status: 'created'
            };
        });

        const uploadSpy = vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockImplementation(async (relId, fileId, blob, onProgress) => {
            const text = await (blob as Blob).text();
            globalEvents.push({
                type: 'upload',
                releaseId: relId,
                fileId,
                blobSize: blob.size,
                blobContent: text
            });
            onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 });
            return { status: 'ok', verified: true, asset: { id: 200, name: 'part' } };
        });

        // Render with custom chunkSize = 10 bytes so 15-byte file divides into 2 parts
        const { ReleaseFileForm } = await import('../components/ReleaseFileForm');
        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <ReleaseFileForm releaseId="rel-auto-1" chunkSize={10} />
            </MemoryRouter>
        );

        const fileInput = screen.getByTestId('local-file-inspect') as HTMLInputElement;
        // 10 bytes + 5 bytes = 15 bytes total
        const p1 = '1234567890';
        const p2 = 'abcde';
        const fakeFile = new File([p1 + p2], 'large-mod.zip', { type: 'application/zip' });

        await user.upload(fileInput, fakeFile);

        await waitFor(() => {
            expect(screen.getByTestId('plan-type-badge')).toBeDefined();
            expect(screen.getByText('Multipart: 2 parts (up to 1 GiB)')).toBeDefined();
            expect(screen.getByTestId('multipart-parts-table')).toBeDefined();
        });

        const submitBtn = screen.getByTestId('submit-asset-btn');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledTimes(2);
            expect(uploadSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByText(/All 2 parts registered, uploaded, and verified successfully!/i)).toBeDefined();
        });

        // 1. Check exact global order of all 4 operations in a single timeline:
        //    1) create part 1
        //    2) create part 2
        //    3) upload id-part-1
        //    4) upload id-part-2
        expect(globalEvents).toHaveLength(4);
        expect(globalEvents.map((e) => e.type)).toEqual(['create', 'create', 'upload', 'upload']);

        // 2. Verify Part 1 metadata creation
        expect(globalEvents[0]).toEqual({
            type: 'create',
            part_index: 1,
            path: 'large-mod.zip.part-001-of-002',
            input: {
                path: 'large-mod.zip.part-001-of-002',
                logical_path: 'large-mod.zip',
                operation: 'add',
                size: 10,
                sha256: 'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646',
                part_index: 1,
                part_count: 2,
                final_sha256: 'cbfb1b82064f6699965f47368a6f95b386d0c8757c5c1c005e44c938377c029f'
            }
        });

        // 3. Verify Part 2 metadata creation
        expect(globalEvents[1]).toEqual({
            type: 'create',
            part_index: 2,
            path: 'large-mod.zip.part-002-of-002',
            input: {
                path: 'large-mod.zip.part-002-of-002',
                logical_path: 'large-mod.zip',
                operation: 'add',
                size: 5,
                sha256: '36bbe50ed96841d10443bcb670d6554f0a34b761be67ec9c4a8ad2c0c44ca42c',
                part_index: 2,
                part_count: 2,
                final_sha256: 'cbfb1b82064f6699965f47368a6f95b386d0c8757c5c1c005e44c938377c029f'
            }
        });

        // 4. Verify Upload 1 (uses real ID 'id-part-1' and exact 10-byte slice blob)
        expect(globalEvents[2]).toEqual({
            type: 'upload',
            releaseId: 'rel-auto-1',
            fileId: 'id-part-1',
            blobSize: 10,
            blobContent: '1234567890'
        });

        // 5. Verify Upload 2 (uses real ID 'id-part-2' and exact 5-byte slice blob)
        expect(globalEvents[3]).toEqual({
            type: 'upload',
            releaseId: 'rel-auto-1',
            fileId: 'id-part-2',
            blobSize: 5,
            blobContent: 'abcde'
        });
    });

    test('4. Metadata creation failure rolls back created entries and reports rollback status', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        // Part 1 succeeds, Part 2 fails with 409 conflict
        vi.spyOn(ReleaseFilesApi, 'createReleaseFile')
            .mockResolvedValueOnce({ id: 'file-part-1-ok', status: 'created' })
            .mockRejectedValueOnce(new ApiClientError(409, 'conflict', ['duplicate_path']));

        const deleteSpy = vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile').mockResolvedValue({ status: 'ok' });
        const uploadSpy = vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset');

        const { ReleaseFileForm } = await import('../components/ReleaseFileForm');
        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <ReleaseFileForm releaseId="rel-auto-1" chunkSize={10} />
            </MemoryRouter>
        );

        const fileInput = screen.getByTestId('local-file-inspect') as HTMLInputElement;
        const fakeFile = new File(['1234567890abcde'], 'multi.zip', { type: 'application/zip' });

        await user.upload(fileInput, fakeFile);

        await waitFor(() => {
            expect(screen.getByTestId('plan-type-badge')).toBeDefined();
        });

        await user.click(screen.getByTestId('submit-asset-btn'));

        await waitFor(() => {
            // Rollback called on part 1
            expect(deleteSpy).toHaveBeenCalledWith('rel-auto-1', 'file-part-1-ok');
            // Upload was NEVER called
            expect(uploadSpy).not.toHaveBeenCalled();
            // Error report includes rollback confirmation
            expect(screen.getByText(/Metadata registration failed on part 2\/2/i)).toBeDefined();
            expect(screen.getByText(/Successfully rolled back 1 created entries/i)).toBeDefined();
        });
    });

    test('5. Upload failure preserves metadata and displays failed part error without silent deletion', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'createReleaseFile').mockResolvedValue({
            id: 'file-created-1',
            status: 'created'
        });

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockRejectedValueOnce(
            new ApiClientError(500, 'UPLOAD_NETWORK_ERROR', [], 'Network timeout while uploading part to local daemon')
        );

        const deleteSpy = vi.spyOn(ReleaseFilesApi, 'deleteReleaseFile');

        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('local-file-inspect')).toBeDefined();
        });

        const fileInput = screen.getByTestId('local-file-inspect') as HTMLInputElement;
        const fakeFile = new File(['small content'], 'asset.bin');

        await user.upload(fileInput, fakeFile);
        await waitFor(() => {
            expect(screen.getByTestId('plan-type-badge')).toBeDefined();
        });

        await user.click(screen.getByTestId('submit-asset-btn'));

        await waitFor(() => {
            // Error banner displayed clearly
            expect(screen.getByText(/Upload failed on part 1\/1 \(asset\.bin\)/i)).toBeDefined();
            expect(screen.getByText(/Metadata was preserved so you can retry upload from the files table/i)).toBeDefined();
            // Metadata was NOT deleted
            expect(deleteSpy).not.toHaveBeenCalled();
        });
    });

    test('6. verified=false displays "Upload completed — verification pending" without false "Upload verified" badge', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        vi.spyOn(ReleaseFilesApi, 'createReleaseFile').mockResolvedValue({
            id: 'file-unverified-1',
            status: 'created'
        });

        vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset').mockResolvedValue({
            status: 'ok',
            verified: false,
            warning: 'UPLOAD_NOT_VERIFIED'
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('local-file-inspect')).toBeDefined();
        });

        const fileInput = screen.getByTestId('local-file-inspect') as HTMLInputElement;
        const fakeFile = new File(['dummy bytes'], 'client.exe');

        await user.upload(fileInput, fakeFile);
        await waitFor(() => {
            expect(screen.getByTestId('plan-type-badge')).toBeDefined();
        });

        await user.click(screen.getByTestId('submit-asset-btn'));

        await waitFor(() => {
            expect(screen.getByText('Upload completed — verification pending')).toBeDefined();
        });

        // Ensure "Upload verified" is NOT displayed
        expect(screen.queryByText('✓ Upload verified')).toBeNull();
    });

    test('7. Operation === "delete" does not show file input or execute inspect/upload, and submits size=0 metadata', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [], Count: 0 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const createSpy = vi.spyOn(ReleaseFilesApi, 'createReleaseFile').mockResolvedValue({
            id: 'file-del-1',
            status: 'created'
        });

        const uploadSpy = vi.spyOn(ReleaseFilesApi, 'uploadPhysicalAsset');

        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/Operation/i)).toBeDefined();
        });

        // Select 'delete'
        const opSelect = screen.getByLabelText(/Operation/i) as HTMLSelectElement;
        await user.selectOptions(opSelect, 'delete');

        // File inspector is HIDDEN
        expect(screen.queryByTestId('local-file-inspect')).toBeNull();
        expect(screen.queryByTestId('file-inspector-card')).toBeNull();

        // Fill path and logical path
        const pathInput = screen.getByLabelText(/^Path/i) as HTMLInputElement;
        const logicalPathInput = screen.getByLabelText(/Logical Path/i) as HTMLInputElement;

        await user.type(pathInput, 'mods/obsolete-mod.jar');
        await user.type(logicalPathInput, 'mods/obsolete-mod.jar');

        const submitBtn = screen.getByTestId('submit-asset-btn');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith('rel-auto-1', {
                path: 'mods/obsolete-mod.jar',
                logical_path: 'mods/obsolete-mod.jar',
                operation: 'delete',
                size: 0
            });
            // Upload was NEVER called
            expect(uploadSpy).not.toHaveBeenCalled();
            expect(screen.getByText('Delete file record created successfully.')).toBeDefined();
        });
    });

    test('8. Editing an existing record opens technical edit inputs and saves PATCH seamlessly', async () => {
        const user = userEvent.setup();
        vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValue(mockDraftRelease);
        vi.spyOn(ReleaseFilesApi, 'listReleaseFiles').mockResolvedValue({ value: [mockExistingFile], Count: 1 });
        vi.spyOn(ReleasesApi, 'validateRelease').mockResolvedValue({ valid: true, issues: [] });

        const updateSpy = vi.spyOn(ReleaseFilesApi, 'updateReleaseFile').mockResolvedValue({
            status: 'ok'
        });

        render(
            <MemoryRouter initialEntries={['/releases/rel-auto-1']}>
                <Routes>
                    <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit old.jar' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit old.jar' }));

        // Edit form opened with technical fields prefilled
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Edit Release File: old.jar' })).toBeDefined();
            expect((screen.getByLabelText('Path') as HTMLInputElement).value).toBe('client/old.jar');
            expect((screen.getByLabelText('Size (bytes)') as HTMLInputElement).value).toBe('1024');
            expect((screen.getByLabelText('SHA-256') as HTMLInputElement).value).toBe('a'.repeat(64));
        });

        // Modify size
        const sizeInput = screen.getByLabelText('Size (bytes)');
        await user.clear(sizeInput);
        await user.type(sizeInput, '2048');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith('rel-auto-1', 'file-existing-1', {
                size: 2048
            });
        });
    });
});
