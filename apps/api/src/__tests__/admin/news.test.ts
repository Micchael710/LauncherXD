import { describe, it, expect, beforeEach, vi } from 'vitest';
import newsApp from '../../routes/admin/news';
import { Hono } from 'hono';
import { createMockD1 } from './d1-mock';
import { AdminIdentity } from '../../auth/admin-auth-provider';

type MockD1 = ReturnType<typeof createMockD1>;

interface ValidationErrorResponse {
  error: string;
  details: string[];
}

interface NewsListResponse {
  value: Array<{
    id: string;
    title?: string;
    image_url?: string | null;
    video_url?: string | null;
  }>;
  Count: number;
}

describe('Admin News CRUD', () => {
  let mockD1: MockD1;
  let env: { DB: D1Database };
  const adminIdentity: AdminIdentity = { subject: 'admin1', email: 'admin@example.com' };

  beforeEach(() => {
    mockD1 = createMockD1();
    env = { DB: mockD1 as unknown as D1Database };
    vi.clearAllMocks();
  });

  const testApp = new Hono<{ Variables: { adminIdentity: AdminIdentity } }>();
  testApp.use('*', async (c, next) => {
    c.set('adminIdentity', adminIdentity);
    await next();
  });
  testApp.route('/', newsApp);

  const request = (method: string, path: string, body?: unknown) => {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return testApp.fetch(req, env);
  };

  it('should create a valid news article', async () => {
    const res = await request('POST', '/', {
      title: 'New Update',
      summary: 'Cool update',
      image_url: 'https://example.com/image.png',
      published: false
    });
    expect(res.status).toBe(201);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject javascript URL for news', async () => {
    const res = await request('POST', '/', {
      title: 'Hacked',
      target_url: 'javascript:alert(1)'
    });
    expect(res.status).toBe(400);
  });

  it('should list all news', async () => {
    mockD1.statement.all.mockResolvedValue({ results: [{ id: '1' }] });
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    const data = (await res.json()) as NewsListResponse;
    expect(data.Count).toBe(1);
  });

  it('should update news', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '1', published: false });
    const res = await request('PATCH', '/1', { title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should delete news', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '1' });
    const res = await request('DELETE', '/1');
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  describe('video_url support & validation', () => {
    it('should create news with a valid MP4 video_url', async () => {
      const res = await request('POST', '/', {
        title: 'Video Teaser',
        video_url: 'https://cdn.example.com/videos/trailer.mp4',
        published: true
      });
      expect(res.status).toBe(201);
      expect(mockD1.statement.run).toHaveBeenCalled();
    });

    it('should create news with a valid WebM video_url and query parameters', async () => {
      const res = await request('POST', '/', {
        title: 'WebM Teaser',
        video_url: 'https://cdn.example.com/videos/trailer.webm?auth=token123&version=1',
        published: true
      });
      expect(res.status).toBe(201);
      expect(mockD1.statement.run).toHaveBeenCalled();
    });

    it('should reject news with both image_url and video_url simultaneously', async () => {
      const res = await request('POST', '/', {
        title: 'Conflicting Media',
        image_url: 'https://example.com/pic.png',
        video_url: 'https://example.com/vid.mp4'
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as ValidationErrorResponse;
      expect(data.details).toContain('cannot_have_both_image_and_video');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should reject video_url with invalid scheme (e.g. javascript: or data:)', async () => {
      const res = await request('POST', '/', {
        title: 'Bad Scheme',
        video_url: 'javascript:alert("exploit.mp4")'
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as ValidationErrorResponse;
      expect(data.details).toContain('invalid_video_url');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should reject video_url with non-mp4/webm extension (e.g. .avi or .mov)', async () => {
      const res = await request('POST', '/', {
        title: 'Bad Extension',
        video_url: 'https://example.com/video.avi'
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as ValidationErrorResponse;
      expect(data.details).toContain('invalid_video_url');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should update news with video_url when image_url is cleared', async () => {
      mockD1.statement.first.mockResolvedValue({ id: '1', image_url: 'https://example.com/pic.png', video_url: null });
      const res = await request('PATCH', '/1', {
        image_url: '',
        video_url: 'https://example.com/new-trailer.mp4'
      });
      expect(res.status).toBe(200);
      expect(mockD1.statement.run).toHaveBeenCalled();
    });

    it('should reject PATCH adding video_url if image_url is already present and not cleared', async () => {
      mockD1.statement.first.mockResolvedValue({ id: '1', image_url: 'https://example.com/pic.png', video_url: null });
      const res = await request('PATCH', '/1', {
        video_url: 'https://example.com/new-trailer.mp4'
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as ValidationErrorResponse;
      expect(data.details).toContain('cannot_have_both_image_and_video');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should support legacy news items where video_url is null', async () => {
      mockD1.statement.all.mockResolvedValue({ results: [{ id: 'legacy-1', title: 'Old News', image_url: 'https://example.com/old.png', video_url: null }] });
      const res = await request('GET', '/');
      expect(res.status).toBe(200);
      const data = (await res.json()) as NewsListResponse;
      expect(data.value[0].video_url).toBeNull();
    });
  });
});
