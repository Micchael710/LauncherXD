import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../../index';
import { createMockD1 } from './d1-mock';
import * as jose from 'jose';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn().mockReturnValue('mock-jwks'),
  jwtVerify: vi.fn(),
}));

describe('Admin Authentication Middleware (ADMIN_API_TOKEN + Cloudflare Access Fallback)', () => {
  let mockDb: any;
  const adminSecret = 'super-secret-admin-token-xyz-999';

  const mockEnv = {
    DB: {} as any,
    GITHUB_OWNER: 'Micchael710',
    GITHUB_RELEASES_REPO: 'LauncherXD-Releases',
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com',
    CLOUDFLARE_ACCESS_AUD: 'test-audience',
    ADMIN_API_TOKEN: adminSecret
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const d1 = createMockD1();
    mockDb = d1;
    mockEnv.DB = mockDb;
  });

  describe('1. ADMIN_API_TOKEN Bearer Authentication', () => {
    it('should authenticate successfully with valid ADMIN_API_TOKEN', async () => {
      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.status).toBe('ok');
      expect(data.admin).toBe('authenticated');
      expect(data.subject).toBe('admin');
      expect(data.email).toBe('admin@local');
    });

    it('should reject request when ADMIN_API_TOKEN is missing from headers', async () => {
      const res = await app.request('/api/admin/health', {
        method: 'GET'
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('unauthorized');
    });

    it('should reject request with invalid Bearer token', async () => {
      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer wrong-invalid-secret'
        }
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('unauthorized');
    });

    it('should reject request with empty Bearer token', async () => {
      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer   '
        }
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('unauthorized');
    });

    it('should reject request with malformed Authorization header (e.g. Basic or raw string)', async () => {
      const resBasic = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${adminSecret}`
        }
      }, mockEnv);
      expect(resBasic.status).toBe(401);

      const resNoPrefix = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': adminSecret
        }
      }, mockEnv);
      expect(resNoPrefix.status).toBe(401);
    });

    it('should fail closed when ADMIN_API_TOKEN is not configured in environment and Bearer is sent', async () => {
      const envWithoutSecret = {
        ...mockEnv,
        ADMIN_API_TOKEN: undefined
      };

      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminSecret}`
        }
      }, envWithoutSecret);

      expect(res.status).toBe(401);
    });

    it('should never expose token or secret values in error responses or body', async () => {
      const leakedCandidate = 'leak-probe-token-777';
      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${leakedCandidate}`
        }
      }, mockEnv);

      expect(res.status).toBe(401);
      const rawText = await res.text();
      expect(rawText).not.toContain(leakedCandidate);
      expect(rawText).not.toContain(adminSecret);
    });
  });

  describe('2. Cloudflare Access Fallback', () => {
    it('should fall back to Cloudflare Access JWT when Authorization header is absent', async () => {
      (jose.jwtVerify as any).mockResolvedValueOnce({
        payload: {
          sub: 'cf-user-456',
          email: 'cf-admin@example.com'
        }
      });

      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'cf-access-jwt-assertion': 'valid-cf-jwt'
        }
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.status).toBe('ok');
      expect(data.admin).toBe('authenticated');
      expect(data.subject).toBe('cf-user-456');
      expect(data.email).toBe('cf-admin@example.com');
    });

    it('should reject if both Bearer is invalid and Cloudflare Access assertion is missing/invalid', async () => {
      (jose.jwtVerify as any).mockRejectedValueOnce(new Error('invalid signature'));

      const res = await app.request('/api/admin/health', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'cf-access-jwt-assertion': 'bad-cf-jwt'
        }
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json() as any;
      expect(data.error).toBe('unauthorized');
    });
  });

  describe('3. Route Protection Scope', () => {
    it('should protect all /api/admin/* endpoints from unauthenticated access', async () => {
      mockDb.statement.all.mockResolvedValueOnce({ results: [] });

      const resReleases = await app.request('/api/admin/releases', { method: 'GET' }, mockEnv);
      expect(resReleases.status).toBe(401);

      const resNews = await app.request('/api/admin/news', { method: 'GET' }, mockEnv);
      expect(resNews.status).toBe(401);

      const resSettings = await app.request('/api/admin/settings', { method: 'GET' }, mockEnv);
      expect(resSettings.status).toBe(401);
    });

    it('should allow public endpoints to function without authentication', async () => {
      mockDb.statement.all.mockResolvedValue({ results: [] });

      const resHealth = await app.request('/health', { method: 'GET' }, mockEnv);
      expect(resHealth.status).toBe(200);

      const resPublicReleases = await app.request('/api/releases/latest', { method: 'GET' }, mockEnv);
      expect(resPublicReleases.status).not.toBe(401);

      const resPublicNews = await app.request('/api/news', { method: 'GET' }, mockEnv);
      expect(resPublicNews.status).toBe(200);

      const resPublicSettings = await app.request('/api/settings/public', { method: 'GET' }, mockEnv);
      expect(resPublicSettings.status).toBe(200);
    });
  });
});
