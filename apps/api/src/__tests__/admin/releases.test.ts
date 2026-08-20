import { describe, it, expect, beforeEach, vi } from 'vitest';
import releasesApp from '../../routes/admin/releases';
import { Hono } from 'hono';
import { createMockD1 } from './d1-mock';
import * as validation from '../../utils/validation';

vi.mock('../../utils/validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/validation')>();
  return { ...actual };
});

describe('Admin Releases CRUD', () => {
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
  testApp.route('/', releasesApp);

  const request = (method: string, path: string, body?: any) => {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return testApp.fetch(req, env);
  };

  it('should create a valid draft release', async () => {
    const res = await request('POST', '/', {
      version: '1.0.0',
      channel: 'stable',
      release_type: 'launcher'
    });
    expect(res.status).toBe(201);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject invalid version', async () => {
    const res = await request('POST', '/', {
      version: 'invalid_version',
      channel: 'stable',
      release_type: 'launcher'
    });
    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.details).toContain('invalid_version');
  });

  it('should reject duplicate release on conflict', async () => {
    mockD1.statement.run.mockRejectedValue(new Error('D1_ERROR: UNIQUE constraint failed'));
    const res = await request('POST', '/', {
      version: '1.0.0',
      channel: 'stable',
      release_type: 'launcher'
    });
    expect(res.status).toBe(409);
  });

  it('should get a release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    const res = await request('GET', '/123');
    expect(res.status).toBe(200);
  });

  it('should update a draft release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    const res = await request('PATCH', '/123', { version: '1.0.1' });
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject updating a published release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'published' });
    const res = await request('PATCH', '/123', { version: '1.0.1' });
    expect(res.status).toBe(409);
  });

  it('should delete a draft release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    const res = await request('DELETE', '/123');
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject deleting a published release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'published' });
    const res = await request('DELETE', '/123');
    expect(res.status).toBe(409);
  });

  it('should return 404 for not found release', async () => {
    mockD1.statement.first.mockResolvedValue(null);
    const res = await request('GET', '/404');
    expect(res.status).toBe(404);
  });
});
