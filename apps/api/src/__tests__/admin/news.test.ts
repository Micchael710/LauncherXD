import { describe, it, expect, beforeEach, vi } from 'vitest';
import newsApp from '../../routes/admin/news';
import { Hono } from 'hono';
import { createMockD1 } from './d1-mock';

describe('Admin News CRUD', () => {
  let mockD1: any;
  let env: any;
  const adminIdentity = { subject: 'admin1', email: 'admin@example.com' };

  beforeEach(() => {
    mockD1 = createMockD1();
    env = { DB: mockD1 };
    vi.clearAllMocks();
  });

  const testApp = new Hono<{ Variables: { adminIdentity: any } }>();
  testApp.use('*', async (c, next) => {
    c.set('adminIdentity', adminIdentity);
    await next();
  });
  testApp.route('/', newsApp);

  const request = (method: string, path: string, body?: any) => {
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
    const data: any = await res.json();
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
});
