import { test, expect, vi, describe, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NewsPage } from '../pages/NewsPage';
import { NewsApi } from '../api/news';
import { ApiClientError } from '../api/client';
import type { NewsItem, CreateNewsResponse } from '../types/news';

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
            video_url: null,
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
            video_url: null,
            target_url: null,
            published: false,
            published_at: null,
            created_at: '2026-08-20T11:00:00Z',
            updated_at: '2026-08-20T11:00:00Z'
        },
        {
            id: 'news-3',
            title: 'Gameplay Trailer Released',
            summary: 'Watch our new trailer in 4K.',
            image_url: null,
            video_url: 'https://cdn.example.com/videos/trailer.mp4',
            target_url: 'https://example.com/trailer',
            published: true,
            published_at: '2026-08-21T12:00:00Z',
            created_at: '2026-08-21T10:00:00Z',
            updated_at: '2026-08-21T10:00:00Z'
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
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNewsList, Count: 3 });

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
            expect(screen.getByText('Gameplay Trailer Released')).toBeDefined();
            expect(screen.getAllByText('Published').length).toBe(2);
            expect(screen.getByText('Draft')).toBeDefined();
            expect(screen.getByTestId('news-media-image-link')).toBeDefined();
            expect(screen.getByTestId('news-media-video-link')).toBeDefined();
            expect(screen.getByRole('button', { name: 'Edit Server Opening Celebration' })).toBeDefined();
            expect(screen.getByRole('button', { name: 'Delete Server Opening Celebration' })).toBeDefined();
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

        // Select Image media type
        await user.click(screen.getByTestId('media-type-image'));

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
            .mockResolvedValueOnce({ value: mockNewsList, Count: 3 });

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

        // Select Image media type
        await user.click(screen.getByTestId('media-type-image'));

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
            video_url: undefined,
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

        await user.type(titleInput, 'Invalid Server Title');
        await user.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText(/Invalid title/i)).toBeDefined();
            expect(alertSpy).not.toHaveBeenCalled();
        });
    });

    test('11. Clicking Edit loads news data into form, changes heading and button labels', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });

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

    test('12. Edit modifying only title sends strictly partial PATCH with title only', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
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
    });

    test('13. Edit modifying only published status sends strictly { published: false }', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
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

    test('14. Edit clearing summary, image URL, and target URL sends empty strings', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
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

    test('15. Edit with no changes does not call PATCH and closes form on Save Changes or Cancel', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
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

    test('16. Delete canceled by user confirmation does NOT call API', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNewsList, Count: 3 });
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

    test('17. Delete confirmed calls deleteNews with exact id and reloads list', async () => {
        const user = userEvent.setup();
        const listSpy = vi.spyOn(NewsApi, 'listNews')
            .mockResolvedValueOnce({ value: mockNewsList, Count: 3 })
            .mockResolvedValueOnce({ value: [mockNewsList[1]], Count: 1 });

        const deleteSpy = vi.spyOn(NewsApi, 'deleteNews').mockResolvedValueOnce({ status: 'ok' });
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

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(screen.queryByText('Server Opening Celebration')).toBeNull();
        });
    });

    // 18. VIDEO SUPPORT TESTS
    test('18. Video media selector displays video_url input and rejects non-mp4/webm formats', async () => {
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

        // Select Video
        await user.click(screen.getByTestId('media-type-video'));

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const videoInput = screen.getByTestId('news-video-url-input');
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'New Teaser Video');
        await user.type(videoInput, 'https://cdn.example.com/video.avi');
        await user.click(submitBtn);

        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/Video URL must be a valid absolute URL starting with http:\/\/ or https:\/\/ and ending in .mp4 or .webm/i)).toBeDefined();
        expect(createSpy).not.toHaveBeenCalled();
    });

    test('19. Creates news with valid MP4 video and renders video preview without autoplay', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews').mockResolvedValueOnce({ id: 'news-v1', status: 'created' } as CreateNewsResponse);

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

        await user.click(screen.getByTestId('media-type-video'));

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const videoInput = screen.getByTestId('news-video-url-input');
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'Trailer 2026');
        await user.type(videoInput, 'https://cdn.example.com/trailer.mp4');

        // Check video preview rendered with controls and no autoplay
        const videoPreview = screen.getByTestId('news-media-video-preview') as HTMLVideoElement;
        expect(videoPreview).toBeDefined();
        expect(videoPreview.getAttribute('controls')).not.toBeNull();
        expect(videoPreview.getAttribute('autoplay')).toBeNull();
        expect(videoPreview.src).toBe('https://cdn.example.com/trailer.mp4');

        await user.click(submitBtn);

        expect(createSpy).toHaveBeenCalledWith({
            title: 'Trailer 2026',
            summary: undefined,
            image_url: undefined,
            video_url: 'https://cdn.example.com/trailer.mp4',
            target_url: undefined,
            published: false
        });
    });

    test('20. Edit preloads video when video_url is present on item', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Gameplay Trailer Released' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Gameplay Trailer Released' }));

        expect(screen.getByRole('heading', { name: 'Edit News: Gameplay Trailer Released' })).toBeDefined();
        expect((screen.getByTestId('media-type-video') as HTMLInputElement).checked).toBe(true);
        expect((screen.getByTestId('news-video-url-input') as HTMLInputElement).value).toBe('https://cdn.example.com/videos/trailer.mp4');
        expect(screen.getByTestId('news-media-video-preview')).toBeDefined();
    });

    test('21. Edit switching from image to video clears image_url and sends video_url', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
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

        // Switch to video
        await user.click(screen.getByTestId('media-type-video'));

        const videoInput = screen.getByTestId('news-video-url-input');
        await user.type(videoInput, 'https://cdn.example.com/opening-video.webm?v=2');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledWith('news-1', {
            image_url: '',
            video_url: 'https://cdn.example.com/opening-video.webm?v=2'
        });
    });

    test('22. Edit switching from video to image clears video_url and sends image_url', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Gameplay Trailer Released' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Gameplay Trailer Released' }));

        // Switch to image
        await user.click(screen.getByTestId('media-type-image'));

        const imageInput = screen.getByLabelText(/Image URL \(optional, http\/https\)/i);
        await user.type(imageInput, 'https://cdn.example.com/poster.png');

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledWith('news-3', {
            image_url: 'https://cdn.example.com/poster.png',
            video_url: ''
        });
    });

    test('23. Edit switching media to None clears both image_url and video_url', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
        const updateSpy = vi.spyOn(NewsApi, 'updateNews').mockResolvedValueOnce({ status: 'ok' });

        render(
            <MemoryRouter initialEntries={['/news']}>
                <Routes>
                    <Route path="/news" element={<NewsPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Edit Gameplay Trailer Released' })).toBeDefined();
        });

        await user.click(screen.getByRole('button', { name: 'Edit Gameplay Trailer Released' }));

        // Switch to none
        await user.click(screen.getByTestId('media-type-none'));

        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(updateSpy).toHaveBeenCalledWith('news-3', {
            video_url: ''
        });
    });

    test('24. Creates news with WebM video format and sends video_url payload', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: [], Count: 0 });
        const createSpy = vi.spyOn(NewsApi, 'createNews').mockResolvedValueOnce({ id: 'news-v2', status: 'created' } as CreateNewsResponse);

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

        await user.click(screen.getByTestId('media-type-video'));

        const titleInput = screen.getByLabelText(/Title \(max 200 chars\)/i);
        const videoInput = screen.getByTestId('news-video-url-input');
        const submitBtn = screen.getByRole('button', { name: 'Create News' });

        await user.type(titleInput, 'WebM Gameplay Clip');
        await user.type(videoInput, 'https://cdn.example.com/clip.webm');
        await user.click(submitBtn);

        expect(createSpy).toHaveBeenCalledWith({
            title: 'WebM Gameplay Clip',
            summary: undefined,
            image_url: undefined,
            video_url: 'https://cdn.example.com/clip.webm',
            target_url: undefined,
            published: false
        });
    });

    test('25. Delete API failure shows error message and does not remove item from UI', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValueOnce({ value: mockNewsList, Count: 3 });
        vi.spyOn(NewsApi, 'deleteNews').mockRejectedValueOnce(new Error('Network error deleting news'));
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

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Network error deleting news')).toBeDefined();
            expect(screen.getByText('Server Opening Celebration')).toBeDefined();
        });
    });

    test('26. Edit save changes API failure displays form error alert and re-enables submit button', async () => {
        const user = userEvent.setup();
        vi.spyOn(NewsApi, 'listNews').mockResolvedValue({ value: mockNewsList, Count: 3 });
        vi.spyOn(NewsApi, 'updateNews').mockRejectedValueOnce(new Error('Failed to update news item'));

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
        await user.type(titleInput, ' Updated');

        const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
        await user.click(saveBtn);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeDefined();
            expect(screen.getByText('Failed to update news item')).toBeDefined();
            expect((screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement).disabled).toBe(false);
        });
    });
});
