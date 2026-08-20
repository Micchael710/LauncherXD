import { describe, it, expect, beforeEach, vi } from 'vitest';
import releasesApp from '../../routes/admin/releases';
import { Hono } from 'hono';
import { createMockD1 } from './d1-mock';

describe('Admin Release Files CRUD', () => {
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
    const req = new Request(`http://localhost/123/files${path === '/' ? '' : path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return testApp.fetch(req, env);
  };

  it('should reject adding a file to a published release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'published' });
    const res = await request('POST', '/', {
      path: 'mods/test.jar',
      logical_path: 'mods/test.jar',
      operation: 'add',
      size: 100,
      sha256: 'a'.repeat(64)
    });
    expect(res.status).toBe(409);
  });

  it('should allow adding a file to a draft release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    const res = await request('POST', '/', {
      path: 'mods/test.jar',
      logical_path: 'mods/test.jar',
      operation: 'add',
      size: 100,
      sha256: 'a'.repeat(64)
    });
    expect(res.status).toBe(201);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject invalid paths', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    const res = await request('POST', '/', {
      path: '../test.jar',
      logical_path: 'mods/test.jar',
      operation: 'add',
      size: 100,
      sha256: 'a'.repeat(64)
    });
    expect(res.status).toBe(400);
  });

  it('should infer filename from path on add', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    await request('POST', '/', {
      path: 'mods/some-dir/test.jar',
      logical_path: 'mods/test.jar',
      operation: 'add',
      size: 100,
      sha256: 'a'.repeat(64)
    });
    // Check bind arguments to verify filename "test.jar" is passed
    const bindArgs = mockD1.statement.bind.mock.calls.flat(2);
    expect(bindArgs).toContain('test.jar');
  });

  it('should allow incomplete multipart upload', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft' });
    const res = await request('POST', '/', {
      path: 'mods/test.part1',
      logical_path: 'mods/test.jar',
      operation: 'add',
      size: 100,
      sha256: 'a'.repeat(64),
      part_index: 1,
      part_count: 2,
      final_sha256: 'b'.repeat(64)
    });
    expect(res.status).toBe(201);
  });
});
