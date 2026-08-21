import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReleasesPage } from '../pages/ReleasesPage';
import { ReleaseCreatePage } from '../pages/ReleaseCreatePage';
import { ReleaseDetailPage } from '../pages/ReleaseDetailPage';
import { ReleasesApi } from '../api/releases';
import { ApiClientError } from '../api/client';
import type { Release } from '../types/releases';

describe('Releases UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('ReleasesPage', () => {
        test('shows loading state while request is pending', () => {
            vi.spyOn(ReleasesApi, 'listReleases').mockImplementation(() => new Promise(() => {}));

            render(
                <MemoryRouter>
                    <ReleasesPage />
                </MemoryRouter>
            );

            expect(screen.getByText('Loading releases...')).toBeDefined();
        });

        test('renders fetched releases and detail links', async () => {
            const mockReleases: Release[] = [
                {
                    id: 'rel-1',
                    version: '1.2.3',
                    channel: 'stable',
                    release_type: 'launcher',
                    status: 'draft',
                    created_at: '2026-08-20T00:00:00Z',
                    updated_at: '2026-08-20T00:00:00Z'
                },
                {
                    id: 'rel-2',
                    version: '2.0.0-beta.1',
                    channel: 'beta',
                    release_type: 'modpack',
                    status: 'published',
                    created_at: '2026-08-20T00:00:00Z',
                    updated_at: '2026-08-20T00:00:00Z'
                }
            ];

            vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({
                value: mockReleases,
                Count: 2
            });

            render(
                <MemoryRouter>
                    <ReleasesPage />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('1.2.3')).toBeDefined();
            });

            expect(screen.getByText('2.0.0-beta.1')).toBeDefined();
            expect(screen.getByText('launcher')).toBeDefined();
            expect(screen.getByText('modpack')).toBeDefined();

            const links = screen.getAllByRole('link', { name: /view details/i });
            expect(links).toHaveLength(2);
            expect(links[0].getAttribute('href')).toBe('/releases/rel-1');
            expect(links[1].getAttribute('href')).toBe('/releases/rel-2');
        });

        test('shows error when API fails', async () => {
            vi.spyOn(ReleasesApi, 'listReleases').mockRejectedValueOnce(
                new ApiClientError(401, 'ADMIN_AUTH_NOT_CONFIGURED', [])
            );

            render(
                <MemoryRouter>
                    <ReleasesPage />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText(/admin authentication is not configured/i)).toBeDefined();
            });
        });

        test('shows empty state when no releases exist', async () => {
            vi.spyOn(ReleasesApi, 'listReleases').mockResolvedValueOnce({
                value: [],
                Count: 0
            });

            render(
                <MemoryRouter>
                    <ReleasesPage />
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('No releases found.')).toBeDefined();
            });
        });
    });

    describe('ReleaseCreatePage & ReleaseForm', () => {
        test('user fills in form, submits expected payload, and navigates on success', async () => {
            const user = userEvent.setup();
            const createSpy = vi.spyOn(ReleasesApi, 'createRelease').mockResolvedValueOnce({ id: 'created-id-456' });

            render(
                <MemoryRouter initialEntries={['/releases/new']}>
                    <Routes>
                        <Route path="/releases/new" element={<ReleaseCreatePage />} />
                        <Route path="/releases/:id" element={<div data-testid="detail-destination">Detail Page</div>} />
                    </Routes>
                </MemoryRouter>
            );

            const versionInput = screen.getByLabelText(/version/i);
            const channelSelect = screen.getByLabelText(/channel/i);
            const typeSelect = screen.getByLabelText(/release type/i);
            const sizeInput = screen.getByLabelText(/total size/i);
            const notesInput = screen.getByLabelText(/release notes/i);
            const submitBtn = screen.getByRole('button', { name: /create draft/i });

            await user.type(versionInput, '3.1.0');
            await user.selectOptions(channelSelect, 'beta');
            await user.selectOptions(typeSelect, 'modpack');
            await user.type(sizeInput, '1048576');
            await user.type(notesInput, 'Initial modpack beta release');

            await user.click(submitBtn);

            expect(createSpy).toHaveBeenCalledTimes(1);
            expect(createSpy).toHaveBeenCalledWith({
                version: '3.1.0',
                channel: 'beta',
                release_type: 'modpack',
                total_size: 1048576,
                release_notes: 'Initial modpack beta release'
            });

            await waitFor(() => {
                expect(screen.getByTestId('detail-destination')).toBeDefined();
            });
        });

        test('submit button is disabled during submission', async () => {
            const user = userEvent.setup();
            let resolvePromise: (value: { id: string }) => void = () => {};
            const deferred = new Promise<{ id: string }>((res) => {
                resolvePromise = res;
            });

            vi.spyOn(ReleasesApi, 'createRelease').mockReturnValueOnce(deferred);

            render(
                <MemoryRouter initialEntries={['/releases/new']}>
                    <Routes>
                        <Route path="/releases/new" element={<ReleaseCreatePage />} />
                        <Route path="/releases/:id" element={<div data-testid="detail-destination">Detail Page</div>} />
                    </Routes>
                </MemoryRouter>
            );

            await user.type(screen.getByLabelText(/version/i), '1.0.0');
            const submitBtn = screen.getByRole('button', { name: /create draft/i });

            await user.click(submitBtn);

            expect(screen.getByRole('button', { name: /submitting/i })).toBeDefined();
            expect(screen.getByRole('button', { name: /submitting/i }).hasAttribute('disabled')).toBe(true);

            resolvePromise({ id: '123' });

            await waitFor(() => {
                expect(screen.getByTestId('detail-destination')).toBeDefined();
            });
        });

        test('validation_error with details appears visibly and does not navigate', async () => {
            const user = userEvent.setup();
            vi.spyOn(ReleasesApi, 'createRelease').mockRejectedValueOnce(
                new ApiClientError(400, 'validation_error', ['invalid_version'])
            );

            render(
                <MemoryRouter initialEntries={['/releases/new']}>
                    <Routes>
                        <Route path="/releases/new" element={<ReleaseCreatePage />} />
                        <Route path="/releases/:id" element={<div data-testid="detail-destination">Detail Page</div>} />
                    </Routes>
                </MemoryRouter>
            );

            await user.type(screen.getByLabelText(/version/i), 'not-a-semver');
            await user.click(screen.getByRole('button', { name: /create draft/i }));

            await waitFor(() => {
                expect(screen.getByText(/invalid semver version/i)).toBeDefined();
            });

            expect(screen.queryByTestId('detail-destination')).toBeNull();
        });
    });

    describe('ReleaseDetailPage', () => {
        test('draft release displays Edit and Delete buttons', async () => {
            const draftRelease: Release = {
                id: 'draft-1',
                version: '1.0.0-draft',
                channel: 'stable',
                release_type: 'launcher',
                status: 'draft',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(draftRelease);

            render(
                <MemoryRouter initialEntries={['/releases/draft-1']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText(/Release Details: 1.0.0-draft/i)).toBeDefined();
            });

            expect(screen.getByRole('button', { name: /^edit$/i })).toBeDefined();
            expect(screen.getByRole('button', { name: /delete draft/i })).toBeDefined();
        });

        test('published release does not display Edit or Delete buttons', async () => {
            const publishedRelease: Release = {
                id: 'pub-1',
                version: '1.0.0',
                channel: 'stable',
                release_type: 'launcher',
                status: 'published',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(publishedRelease);

            render(
                <MemoryRouter initialEntries={['/releases/pub-1']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText(/Release Details: 1.0.0/i)).toBeDefined();
            });

            expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
            expect(screen.queryByRole('button', { name: /delete draft/i })).toBeNull();
        });

        test('deprecated release does not display Edit or Delete buttons', async () => {
            const deprecatedRelease: Release = {
                id: 'dep-1',
                version: '0.9.0',
                channel: 'beta',
                release_type: 'launcher',
                status: 'deprecated',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(deprecatedRelease);

            render(
                <MemoryRouter initialEntries={['/releases/dep-1']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText(/Release Details: 0.9.0/i)).toBeDefined();
            });

            expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
            expect(screen.queryByRole('button', { name: /delete draft/i })).toBeNull();
        });

        test('Edit loads current values and sends expected PATCH', async () => {
            const user = userEvent.setup();
            const draftRelease: Release = {
                id: 'draft-edit-1',
                version: '1.0.0',
                channel: 'stable',
                release_type: 'launcher',
                status: 'draft',
                total_size: 5000,
                release_notes: 'Initial notes',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease')
                .mockResolvedValueOnce(draftRelease)
                .mockResolvedValueOnce({ ...draftRelease, channel: 'beta', release_notes: 'Updated notes' });

            const updateSpy = vi.spyOn(ReleasesApi, 'updateRelease').mockResolvedValueOnce();

            render(
                <MemoryRouter initialEntries={['/releases/draft-edit-1']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /^edit$/i })).toBeDefined();
            });

            await user.click(screen.getByRole('button', { name: /^edit$/i }));

            const versionInput = screen.getByLabelText(/version/i);
            const channelSelect = screen.getByLabelText(/channel/i);
            const notesInput = screen.getByLabelText(/release notes/i);

            expect((versionInput as HTMLInputElement).value).toBe('1.0.0');
            expect((channelSelect as HTMLSelectElement).value).toBe('stable');
            expect((notesInput as HTMLTextAreaElement).value).toBe('Initial notes');

            await user.selectOptions(channelSelect, 'beta');
            await user.clear(notesInput);
            await user.type(notesInput, 'Updated notes');

            await user.click(screen.getByRole('button', { name: /save changes/i }));

            expect(updateSpy).toHaveBeenCalledWith('draft-edit-1', {
                version: '1.0.0',
                channel: 'beta',
                release_type: 'launcher',
                total_size: 5000,
                release_notes: 'Updated notes'
            });
        });

        test('Delete calls API and navigates after confirmation', async () => {
            const user = userEvent.setup();
            const draftRelease: Release = {
                id: 'draft-del-1',
                version: '1.0.0',
                channel: 'stable',
                release_type: 'launcher',
                status: 'draft',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(draftRelease);
            const deleteSpy = vi.spyOn(ReleasesApi, 'deleteRelease').mockResolvedValueOnce();
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

            render(
                <MemoryRouter initialEntries={['/releases/draft-del-1']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                        <Route path="/releases" element={<div data-testid="releases-list">Releases List</div>} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /delete draft/i })).toBeDefined();
            });

            await user.click(screen.getByRole('button', { name: /delete draft/i }));

            expect(confirmSpy).toHaveBeenCalledTimes(1);
            expect(deleteSpy).toHaveBeenCalledWith('draft-del-1');

            await waitFor(() => {
                expect(screen.getByTestId('releases-list')).toBeDefined();
            });
        });

        test('canceling delete confirmation does not call delete API', async () => {
            const user = userEvent.setup();
            const draftRelease: Release = {
                id: 'draft-del-2',
                version: '1.0.0',
                channel: 'stable',
                release_type: 'launcher',
                status: 'draft',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(draftRelease);
            const deleteSpy = vi.spyOn(ReleasesApi, 'deleteRelease');
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

            render(
                <MemoryRouter initialEntries={['/releases/draft-del-2']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /delete draft/i })).toBeDefined();
            });

            await user.click(screen.getByRole('button', { name: /delete draft/i }));

            expect(confirmSpy).toHaveBeenCalledTimes(1);
            expect(deleteSpy).not.toHaveBeenCalled();
        });

        test('only_drafts_can_be_deleted conflict error displays visibly without alert', async () => {
            const user = userEvent.setup();
            const draftRelease: Release = {
                id: 'draft-del-3',
                version: '1.0.0',
                channel: 'stable',
                release_type: 'launcher',
                status: 'draft',
                created_at: '2026-08-20T00:00:00Z',
                updated_at: '2026-08-20T00:00:00Z'
            };

            vi.spyOn(ReleasesApi, 'getRelease').mockResolvedValueOnce(draftRelease);
            vi.spyOn(ReleasesApi, 'deleteRelease').mockRejectedValueOnce(
                new ApiClientError(409, 'conflict', ['only_drafts_can_be_deleted'])
            );
            vi.spyOn(window, 'confirm').mockReturnValue(true);
            const alertSpy = vi.spyOn(window, 'alert');

            render(
                <MemoryRouter initialEntries={['/releases/draft-del-3']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /delete draft/i })).toBeDefined();
            });

            await user.click(screen.getByRole('button', { name: /delete draft/i }));

            await waitFor(() => {
                expect(screen.getByText('Only draft releases can be deleted.')).toBeDefined();
            });

            expect(alertSpy).not.toHaveBeenCalled();
        });

        test('404 displays Release not found message', async () => {
            vi.spyOn(ReleasesApi, 'getRelease').mockRejectedValueOnce(
                new ApiClientError(404, 'not_found', [])
            );

            render(
                <MemoryRouter initialEntries={['/releases/missing-999']}>
                    <Routes>
                        <Route path="/releases/:id" element={<ReleaseDetailPage />} />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText('Release not found.')).toBeDefined();
            });
        });
    });
});
