import { describe, it, expect, beforeEach, vi } from 'vitest';
import releasesApp from '../../routes/admin/releases';
import { Hono } from 'hono';
import { createMockD1 } from './d1-mock';
import type { PurgeCapabilityResponse, PurgeReleaseResponse } from '../../types';

interface ApiErrorBody {
  error: string;
  details?: string[];
  message?: string;
}

describe('Admin Releases CRUD', () => {
  let mockD1: ReturnType<typeof createMockD1>;
  let env: { DB: unknown };
  const adminIdentity = { subject: 'admin1', email: 'admin@example.com' };

  beforeEach(() => {
    mockD1 = createMockD1();
    env = { DB: mockD1 };
    vi.clearAllMocks();
  });

  const testApp = new Hono<{ Variables: { adminIdentity: typeof adminIdentity } }>();
  testApp.use('*', async (c, next) => {
    c.set('adminIdentity', adminIdentity);
    await next();
  });
  testApp.route('/', releasesApp);

  const request = (method: string, path: string, body?: unknown) => {
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
    const data = await res.json() as ApiErrorBody;
    expect(data.details).toContain('invalid_version');
  });

  it('should reject duplicate release on conflict', async () => {
    mockD1.statement.run.mockRejectedValue(new Error('UNIQUE constraint failed: releases.version'));
    const res = await request('POST', '/', {
      version: '1.0.0',
      channel: 'stable',
      release_type: 'launcher'
    });
    expect(res.status).toBe(409);
    const data = await res.json() as ApiErrorBody;
    expect(data.error).toBe('conflict');
  });

  it('should update a draft release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft', release_type: 'launcher', version: '1.0.0' });
    const res = await request('PATCH', '/123', {
      release_notes: 'New notes'
    });
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject update if release is not draft', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'published', release_type: 'launcher', version: '1.0.0' });
    const res = await request('PATCH', '/123', {
      release_notes: 'New notes'
    });
    expect(res.status).toBe(409);
    expect(mockD1.statement.run).not.toHaveBeenCalled();
  });

  it('should delete a draft release', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'draft', release_type: 'launcher', version: '1.0.0' });
    const res = await request('DELETE', '/123');
    expect(res.status).toBe(200);
    expect(mockD1.statement.run).toHaveBeenCalled();
  });

  it('should reject delete if release is not draft', async () => {
    mockD1.statement.first.mockResolvedValue({ id: '123', status: 'published', release_type: 'launcher', version: '1.0.0' });
    const res = await request('DELETE', '/123');
    expect(res.status).toBe(409);
    expect(mockD1.statement.run).not.toHaveBeenCalled();
  });

  describe('GET /:id/purge-capability', () => {
    it('should return capability available: true for draft modpack', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'mod-1',
        release_type: 'modpack',
        version: '1.0.0',
        status: 'draft'
      });
      const res = await request('GET', '/mod-1/purge-capability');
      expect(res.status).toBe(200);
      const data = await res.json() as PurgeCapabilityResponse;
      expect(data).toEqual({
        available: true,
        release_id: 'mod-1',
        release_type: 'modpack',
        status: 'draft',
        version: '1.0.0'
      });
    });

    it('should return capability available: true for published modpack', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'mod-pub',
        release_type: 'modpack',
        version: '2.0.0',
        status: 'published'
      });
      const res = await request('GET', '/mod-pub/purge-capability');
      expect(res.status).toBe(200);
      const data = await res.json() as PurgeCapabilityResponse;
      expect(data).toEqual({
        available: true,
        release_id: 'mod-pub',
        release_type: 'modpack',
        status: 'published',
        version: '2.0.0'
      });
    });

    it('should return capability available: true for deprecated modpack', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'mod-dep',
        release_type: 'modpack',
        version: '0.9.0',
        status: 'deprecated'
      });
      const res = await request('GET', '/mod-dep/purge-capability');
      expect(res.status).toBe(200);
      const data = await res.json() as PurgeCapabilityResponse;
      expect(data).toEqual({
        available: true,
        release_id: 'mod-dep',
        release_type: 'modpack',
        status: 'deprecated',
        version: '0.9.0'
      });
    });

    it('should reject capability check for launcher release_type with 400', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'lnch-1',
        release_type: 'launcher',
        version: '1.0.0',
        status: 'published'
      });
      const res = await request('GET', '/lnch-1/purge-capability');
      expect(res.status).toBe(400);
      const data = await res.json() as ApiErrorBody;
      expect(data.details).toContain('only_modpacks_can_be_purged');
    });

    it('should return 404 if release does not exist', async () => {
      mockD1.statement.first.mockResolvedValue(null);
      const res = await request('GET', '/missing-id/purge-capability');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /:id/purge', () => {
    it('should purge a draft modpack release with exact confirmations', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'mod-1',
        release_type: 'modpack',
        version: '1.0.0-beta.1',
        status: 'draft'
      });
      const res = await request('POST', '/mod-1/purge', {
        confirm_version: '1.0.0-beta.1',
        confirm_phrase: 'DELETE 1.0.0-beta.1'
      });
      expect(res.status).toBe(200);
      const data = await res.json() as PurgeReleaseResponse;
      expect(data.purged).toBe(true);
      expect(mockD1.statement.run).toHaveBeenCalled();
    });

    it('should purge a published modpack release with exact confirmations', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'mod-2',
        release_type: 'modpack',
        version: '2.0.0',
        status: 'published'
      });
      const res = await request('POST', '/mod-2/purge', {
        confirm_version: '2.0.0',
        confirm_phrase: 'DELETE 2.0.0'
      });
      expect(res.status).toBe(200);
      const data = await res.json() as PurgeReleaseResponse;
      expect(data.purged).toBe(true);
      expect(mockD1.statement.run).toHaveBeenCalled();
    });

    it('should purge a deprecated modpack release with exact confirmations', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'mod-3',
        release_type: 'modpack',
        version: '0.1.0',
        status: 'deprecated'
      });
      const res = await request('POST', '/mod-3/purge', {
        confirm_version: '0.1.0',
        confirm_phrase: 'DELETE 0.1.0'
      });
      expect(res.status).toBe(200);
      const data = await res.json() as PurgeReleaseResponse;
      expect(data.purged).toBe(true);
      expect(mockD1.statement.run).toHaveBeenCalled();
    });

    it('should reject purging launcher releases with 400', async () => {
      mockD1.statement.first.mockResolvedValue({
        id: 'launcher-1',
        release_type: 'launcher',
        version: '1.0.0',
        status: 'published'
      });
      const res = await request('POST', '/launcher-1/purge', {
        confirm_version: '1.0.0',
        confirm_phrase: 'DELETE 1.0.0'
      });
      expect(res.status).toBe(400);
      const data = await res.json() as ApiErrorBody;
      expect(data.details).toContain('only_modpacks_can_be_purged');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should reject purging when confirm_version does not match', async () => {
      mockD1.statement.first.mockResolvedValue({ id: 'mod-1', release_type: 'modpack', version: '1.2.0', status: 'draft' });
      const res = await request('POST', '/mod-1/purge', {
        confirm_version: '1.2.1',
        confirm_phrase: 'DELETE 1.2.0'
      });
      expect(res.status).toBe(400);
      const data = await res.json() as ApiErrorBody;
      expect(data.details).toContain('invalid_confirm_version');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should reject purging when confirm_phrase does not match', async () => {
      mockD1.statement.first.mockResolvedValue({ id: 'mod-1', release_type: 'modpack', version: '1.2.0', status: 'draft' });
      const res = await request('POST', '/mod-1/purge', {
        confirm_version: '1.2.0',
        confirm_phrase: 'DELETE 9.9.9'
      });
      expect(res.status).toBe(400);
      const data = await res.json() as ApiErrorBody;
      expect(data.details).toContain('invalid_confirm_phrase');
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });

    it('should return 404 if release does not exist for purge', async () => {
      mockD1.statement.first.mockResolvedValue(null);
      const res = await request('POST', '/non-existent/purge', {
        confirm_version: '1.0.0',
        confirm_phrase: 'DELETE 1.0.0'
      });
      expect(res.status).toBe(404);
      expect(mockD1.statement.run).not.toHaveBeenCalled();
    });
  });
});
