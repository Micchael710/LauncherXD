import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewsPage } from '../pages/NewsPage';
import { NewsApi } from '../api/news';
import { ApiClientError } from '../api/client';
import type { NewsItem, CreateNewsResponse, NewsActionResponse } from '../types/news';

describe('News UI Functional Tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const mockNewsList: NewsItem[] = [
        {
            id: 'news-1',
            title: 'Server Opening Celebration',
            summary: 'Welcome everyone to the grand opening of LauncherXD Minecraft server!',
            image_url: 'https://cdn.example.com/banner.png',
            target_url: 'https://example.com/announcement',
            published: true,
            published_at: '2026-08-20T12:00:00Z',
            created_at: '2026-08-20T10:00:00Z',
            updated_at: '2026-08-20T10:00:00Z'
        },
        {
            id: 'news-2',
            title: 'Upcoming Maintenance Notice',
            summary: 'Brief scheduled maintenance tomorrow morning.',
            image_url: null,
            target_url: null,
            published: false,
            published_at: null,
            created_at: '2026-08-20T11:00:00Z',
            updated_at: '2026-08-20T11:00:00Z'
        }
    ];

    test('1. Shows loading state while request is pending', async () => {
        vi.spyOn(NewsApi, 'listNews').mockImplementation(() => new Promise(() => {}));

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByTestId('news-loading')).toBeDefined();
        expect(screen.getByText('Loading news...')).toBeDefined();
    });

    test('2. Displays empty state when news list is empty', async () => {
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('news-empty')).toBeDefined();
            expect(screen.getByText('No news found.')).toBeDefined();
        });
    });

    test('3. Renders news list displaying Published and Draft statuses with links and actions', async () => {
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNewsList, Count: 2 });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Server Opening Celebration')).toBeDefined();
            expect(screen.getByText('Upcoming Maintenance Notice')).toBeDefined();
            expect(screen.getByText('Published')).toBeDefined();
            expect(screen.getByText('Draft')).toBeDefined();
            expect(screen.getByRole('link', { name: 'View Image' })).toBeDefined();
            expect(screen.getByRole('link', { name: 'Open Link' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Delete Server Opening Celebration' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit Upcoming Maintenance Notice' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Delete Upcoming Maintenance Notice' })).toBeDefined();
        });
    });

    test('4. Displays validation error when title is empty', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const submitBtn = screen.getByRole('button', { name: 'Create News' });
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Title is required.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('4b. Displays validation error when title is only whitespace', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        await user.type(titleInput, '     ');

        const submitBtn = screen.getByRole('button', { name: 'Create News' });
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Title is required.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('5. Rejects title exceeding 200 characters locally', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const longTitle = 'A'.repeat(201);
        fireEvent.change(titleInput, { target: { value: longTitle } });

        const submitBtn = screen.getByRole('button', { name: 'Create News' });
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Title cannot exceed 200 characters.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('6. Rejects summary exceeding 1000 characters locally', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        await user.type(titleInput, 'Valid Title');

        const summaryInput = screen.getByLabelText(/Summary \(optional, max 1000 chars\)/i);
        const longSummary = 'S'.repeat(1001);
        fireEvent.change(summaryInput, { target: { value: longSummary } });

        const submitBtn = screen.getByRole('button', { name: 'Create News' });
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Summary cannot exceed 1000 characters.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('7. Rejects javascript: protocol in image_url and target_url', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const imageInput = screen.getByLabelText(/Image URL \(optional, http\/https\)/i);
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'Valid News');
        await user.type(imageInput, 'javascript:alert(1)');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Image URL must be a valid absolute URL starting with http:// or https://.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();

        await user.clear(imageInput);
        const targetInput = screen.getByLabelText(/Target URL \(optional, http\/https\)/i);
        await user.type(targetInput, 'javascript:void(0)');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Target URL must be a valid absolute URL starting with http:// or https://.')).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('8. Accepts valid http: and https: URLs and submits exact payload with checkbox', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(NewsApi, 'listNews')
            .mockResolvedValueOnce({ value: [], Count: 0 })
            .mockResolvedValueOnce({ value: mockNewsList, Count: 2 });

        const createSpy = vi.spyOn(NewsApi, 'createNews').mockResolvedValueOnce({ id: 'news-new-1', status: 'created' } as CreateNewsResponse);

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const summaryInput = screen.getByLabelText(/Summary \(optional, max 1000 chars\)/i);
        const imageInput = screen.getByLabelText(/Image URL \(optional, http\/https\)/i);
        const targetInput = screen.getByLabelText(/Target URL \(optional, http\/https\)/i);
        const publishCheckbox = screen.getByLabelText(/Publish immediately/i);
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'New Launch Version');
        await user.type(summaryInput, 'Launch summary details');
        await user.type(imageInput, 'http://example.com/image.png');
        await user.type(targetInput, 'https://example.com/target');
        await user.click(publishCheckbox);

        await user.click(submitBtn);

        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).toHaveBeenCalledWith({
            title: 'New Launch Version',
            summary: 'Launch summary details',
            image_url: 'http://example.com/image.png',
            target_url: 'https://example.com/target',
            published: true
        });

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Server Opening Celebration')).toBeDefined();
        });
    });

    test('9. Disables submit button during submission and shows Creating...', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: [], Count: 0 });

        let resolveCreate: ((res: CreateNewsResponse) => void) | undefined;
        vi.spyOn(NewsApi, 'createNews').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveCreate = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'Pending News Creation');
        await user.click(submitBtn);

        expect(submitBtn.textContent).toBe('Creating...');
        expect(submitBtn.hasAttribute('disabled')).toBe(true);

        resolveCreate?.({ id: 'news-99', status: 'created' });

        await waitFor(() => {
            expect(submitBtn.textContent).toBe('Create News');
            expect(submitBtn.hasAttribute('disabled')).toBe(false);
        });
    });

    test('10. Displays visible API error banner on failed POST without alert', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        vi.spyOn(NewsApi, 'createNews').mockRejectedValueOnce(
            new ApiClientError(400, 'validation_error', ['invalid_title'])
        );
        const alertSpy = vi.spyOn(window, 'alert');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'Bad Title');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Validation error: Invalid title (must be non-empty and max 200 characters).')).toBeDefined();
            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    test('11. Displays authentication error when list request fails with 401', async () => {
        vi.spyOn(NewsApi, 'listNews').mockRejectedValueOnce(
            new ApiClientError(401, 'ADMIN_AUTH_NOT_CONFIGURED', [], 'Admin authentication is not configured.')
        );

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Admin authentication is not configured.')).toBeDefined();
        });
    });

    test('12. Edit button pre-populates form with row data without individual GET', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNewsList, Count: 2 });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        expect(screen.getByRole('heading', { name: 'Edit News: Server Opening Celebration' })).toBeDefined();
        expect((screen.getByLabelText(/Title \(max 200 chars\)/i) as HTMLInputElement).value).toBe('Server Opening Celebration');
        expect((screen.getByLabelText(/Summary \(optional, max 1000 chars\)/i) as HTMLTextAreaElement).value).toBe(
            'Welcome everyone to the grand opening of LauncherXD Minecraft server!'
        );
        expect((screen.getByLabelText(/Image URL \(optional, http\/https\)/i) as HTMLInputElement).value).toBe(
            'https://cdn.example.com/banner.png'
        );
        expect((screen.getByLabelText(/Target URL \(optional, http\/https\)/i) as HTMLInputElement).value).toBe(
            'https://example.com/announcement'
        );
        expect((screen.getByLabelText(/^Published/i) as HTMLInputElement).checked).toBe(true);
        expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    });

    test('13. Edit modifying only title sends strictly partial PATCH with title only', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        await user.clear(titleInput);
        await user.type(titleInput, 'Grand Server Opening Celebration 2026');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith('news-1', {
            title: 'Grand Server Opening Celebration 2026'
        });

        const patchPayload = updateSpy.mock.calls[0][1];
        expect(patchPayload.summary).toBeUndefined();
        expect(patchPayload.image_url).toBeUndefined();
        expect(patchPayload.target_url).toBeUndefined();
        expect(patchPayload.published).toBeUndefined();
    });

    test('14. Edit modifying only published status sends strictly { published: false }', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        const publishCheckbox = screen.getByLabelText(/^Published/i);
        await user.click(publishCheckbox); // Uncheck

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith('news-1', {
            published: false
        });
    });

    test('15. Edit clearing summary, image URL, and target URL sends empty strings', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        const summaryInput = screen.getByLabelText(/Summary \(optional, max 1000 chars\)/i);
        const imageInput = screen.getByLabelText(/Image URL \(optional, http\/https\)/i);
        const targetInput = screen.getByLabelText(/Target URL \(optional, http\/https\)/i);

        await user.clear(summaryInput);
        await user.clear(imageInput);
        await user.clear(targetInput);

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith('news-1', {
            summary: '',
            image_url: '',
            target_url: ''
        });
    });

    test('16. Edit with no changes does not call PATCH and closes form on Save Changes or Cancel', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));
        expect(screen.getByRole('heading', { name: 'Edit News: Server Opening Celebration' })).toBeDefined();

        // Click Save Changes without modifying anything
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));
        expect(updateSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();

        // Open edit again and click Cancel
        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));
        expect(screen.getByRole('heading', { name: 'Edit News: Server Opening Celebration' })).toBeDefined();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(updateSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
    });

    test('17. Edit validates title, summary, and URLs before calling API', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews');

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        // 1. Empty title
        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        fireEvent.change(titleInput, { target: { value: '' } });
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Title is required.')).toBeDefined();
        expect(updateSpy).not.toHaveBeenCalled();

        // Restore valid title
        await user.type(titleInput, 'Valid Title');

        // 2. Summary > 1000 characters
        const summaryInput = screen.getByLabelText(/Summary \(optional, max 1000 chars\)/i);
        fireEvent.change(summaryInput, { target: { value: 'S'.repeat(1001) } });
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Summary cannot exceed 1000 characters.')).toBeDefined();
        expect(updateSpy).not.toHaveBeenCalled();

        // Restore valid summary
        await user.clear(summaryInput);
        await user.type(summaryInput, 'Valid summary');

        // 3. Image URL with javascript:
        const imageInput = screen.getByLabelText(/Image URL \(optional, http\/https\)/i);
        await user.clear(imageInput);
        await user.type(imageInput, 'javascript:alert(1)');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Image URL must be a valid absolute URL starting with http:// or https://.')).toBeDefined();
        expect(updateSpy).not.toHaveBeenCalled();

        // Restore valid image URL
        await user.clear(imageInput);
        await user.type(imageInput, 'https://example.com/banner.png');

        // 4. Target URL with invalid protocol (ftp://)
        const targetInput = screen.getByLabelText(/Target URL \(optional, http\/https\)/i);
        await user.clear(targetInput);
        await user.type(targetInput, 'ftp://example.com/file');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Target URL must be a valid absolute URL starting with http:// or https://.')).toBeDefined();
        expect(updateSpy).not.toHaveBeenCalled();
    });

    test('18. PATCH in progress displays Saving... and disables all form controls', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });

        let resolvePatch: ((res: NewsActionResponse) => void) | undefined;
        vi.spyOn(NewsApi, 'updateNews').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolvePatch = resolve;
            });
        });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const summaryInput = screen.getByLabelText(/Summary \(optional, max 1000 chars\)/i);
        const imageInput = screen.getByLabelText(/Image URL \(optional, http\/https\)/i);
        const targetInput = screen.getByLabelText(/Target URL \(optional, http\/https\)/i);
        const publishedCheckbox = screen.getByLabelText(/^Published/i);
        const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });

        await user.type(titleInput, ' (Updated)');
        await user.click(saveBtn);

        expect(saveBtn.textContent).toBe('Saving...');
        expect(saveBtn.hasAttribute('disabled')).toBe(true);
        expect(cancelBtn.hasAttribute('disabled')).toBe(true);
        expect(titleInput.hasAttribute('disabled')).toBe(true);
        expect(summaryInput.hasAttribute('disabled')).toBe(true);
        expect(imageInput.hasAttribute('disabled')).toBe(true);
        expect(targetInput.hasAttribute('disabled')).toBe(true);
        expect(publishedCheckbox.hasAttribute('disabled')).toBe(true);

        resolvePatch?.({ status: 'ok' });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
        });
    });

    test('18b. Successful PATCH calls listNews twice, updates table, and closes edit form', async () => {
        const user = userEvent.setup();
        const updatedNewsList: NewsItem[] = [
            {
                ...mockNewsList[0],
                title: 'Updated Server Opening 2026',
                summary: 'New celebratory details!'
            },
            mockNewsList[1]
        ];

        const listSpy = vi.spyOn(NewsApi, 'listNews')
            .mockResolvedValueOnce({ value: mockNewsList, Count: 2 })
            .mockResolvedValueOnce({ value: updatedNewsList, Count: 2 });

        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        await user.clear(titleInput);
        await user.type(titleInput, 'Updated Server Opening 2026');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.getByRole('heading', { name: 'Create News' })).toBeDefined();
            expect(screen.getByText('Updated Server Opening 2026')).toBeDefined();
            expect(screen.getByText('New celebratory details!')).toBeDefined();
            expect(screen.queryByText('Server Opening Celebration')).toBeNull();
        });
    });

    test('19. PATCH failure displays visible error alert and handles 404 as News item not found.', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        vi.spyOn(NewsApi, 'updateNews').mockRejectedValueOnce(
            new ApiClientError(404, 'not_found')
        );

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));
        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        await user.type(titleInput, ' Changed');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('News item not found.')).toBeDefined();
            expect(screen.queryByText('Release not found.')).toBeNull();
        });
    });

    test('19b. New local validation error takes priority over previous API error and blocks PATCH', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockRejectedValueOnce(
            new ApiClientError(404, 'not_found')
        );

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Server Opening Celebration' }));
        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        await user.type(titleInput, ' Changed');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('News item not found.')).toBeDefined();
        });

        // Now clear the title and click Save Changes again
        fireEvent.change(titleInput, { target: { value: '' } });
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText('Title is required.')).toBeDefined();
        expect(screen.queryByText('News item not found.')).toBeNull();
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    test('20. Delete canceled by user confirmation does NOT call API', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNewsList, Count: 2 });
        const deleteSpy = vi.spyOn(NewsApi, 'deleteNews');
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Delete Server Opening Celebration' }));

        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete news "Server Opening Celebration"?');
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    test('21. Delete confirmed calls deleteNews with exact id, shows Deleting... and reloads list on success', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(NewsApi, 'listNews')
            .mockResolvedValueOnce({ value: mockNewsList, Count: 2 })
            .mockResolvedValueOnce({ value: [mockNewsList[1]], Count: 1 });

        let resolveDelete: ((res: NewsActionResponse) => void) | undefined;
        const deleteSpy = vi.spyOn(NewsApi, 'deleteNews').mockImplementationOnce(() => {
            return new Promise((resolve) => {
                resolveDelete = resolve;
            });
        });
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Server Opening Celebration' })).toBeDefined();
        });

        const deleteBtn = screen.getByRole('button', { name: 'Delete Server Opening Celebration' });
        await user.click(deleteBtn);

        expect(deleteSpy).toHaveBeenCalledWith('news-1');
        expect(deleteBtn.textContent).toBe('Deleting...');
        expect(deleteBtn.hasAttribute('disabled')).toBe(true);

        resolveDelete?.({ status: 'ok' });

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.queryByText('Server Opening Celebration')).toBeNull();
            expect(screen.getByText('Upcoming Maintenance Notice')).toBeDefined();
        });
    });

    test('22. Delete error preserves row in list and displays visible error alert (with News item not found.)', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 2 });
        vi.spyOn(NewsApi, 'deleteNews').mockRejectedValueOnce(
            new ApiClientError(404, 'not_found')
        );
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Server Opening Celebration' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Delete Server Opening Celebration' }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('News item not found.')).toBeDefined();
            expect(screen.queryByText('Release not found.')).toBeNull();
            expect(screen.getByText('Server Opening Celebration')).toBeDefined();
        });
    });
});
