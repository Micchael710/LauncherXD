import { describe, it, expect, beforeEach, vi } from 'vitest';
import settingsApp from '../../routes/admin/settings';
import { Hono } from 'hono';
import { createMockD1 } from './d1-mock';

describe('Admin Settings CRUD', () => {
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
  testApp.route('/', settingsApp);

  const request = (method: string, path: string, body?: any) => {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return testApp.fetch(req, env);
  };

  it('should list all settings', async () => {
    mockD1.statement.all.mockResolvedValue({ results: [{ key: 'launcher_name' }] });
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.Count).toBe(1);
  });

  it('should create or update a valid setting', async () => {
    const res = await request('PUT', '/launcher_name', {
      value: 'MyLauncher',
      value_type: 'string',
      is_public: true
    });
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject creating a setting containing secrets like GITHUB_TOKEN', async () => {
    const res = await request('PUT', '/github_token', {
      value: 'secret',
      value_type: 'string',
      is_public: false
    });
    expect(res.status).toBe(400);
  });

  it('should reject invalid boolean type', async () => {
    const res = await request('PUT', '/some_boolean', {
      value: 'not_true_or_false',
      value_type: 'boolean',
      is_public: false
    });
    expect(res.status).toBe(400);
  });

  it('should reject invalid number type', async () => {
    const res = await request('PUT', '/some_number', {
      value: 'abc',
      value_type: 'number',
      is_public: false
    });
    expect(res.status).toBe(400);
  });
});
