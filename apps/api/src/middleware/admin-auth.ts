import { Context, Next } from 'hono';
import { CloudflareAccessAuthProvider } from '../auth/cloudflare-access-auth-provider';
import { AdminIdentity } from '../auth/admin-auth-provider';

// JWKS instances should be cached globally across requests for the same isolate
let authProviderCache: CloudflareAccessAuthProvider | null = null;

async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) {
    return false;
  }
  const encoder = new TextEncoder();
  const [aDigest, bDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b))
  ]);
  const aArr = new Uint8Array(aDigest);
  const bArr = new Uint8Array(bDigest);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) {
    diff |= aArr[i] ^ bArr[i];
  }
  return diff === 0 && a.length === b.length;
}

export function adminAuth() {
  return async (c: Context, next: Next) => {
    // 1. Check for Bearer token against ADMIN_API_TOKEN
    const authHeader = c.req.header('authorization') || c.req.raw.headers.get('authorization');
    const expectedAdminToken = c.env?.ADMIN_API_TOKEN;

    if (authHeader && typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        const token = match[1].trim();
        if (expectedAdminToken && token && await timingSafeEqualStrings(token, expectedAdminToken)) {
          const localAdminIdentity: AdminIdentity = {
            subject: 'admin',
            email: 'admin@local'
          };
          c.set('adminIdentity', localAdminIdentity);
          await next();
          return;
        }
      }
    }

    // 2. Fallback to Cloudflare Access
    try {
      if (!authProviderCache) {
        authProviderCache = new CloudflareAccessAuthProvider({
          teamDomain: c.env?.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
          audience: c.env?.CLOUDFLARE_ACCESS_AUD
        });
      }

      const identity = await authProviderCache.authenticate(c.req.raw);
      c.set('adminIdentity', identity);
      await next();
    } catch {
      console.log('[AdminAuth] Access denied');
      return c.json({ error: 'unauthorized' }, 401);
    }
  };
}
