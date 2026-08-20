import { Context, Next } from 'hono';
import { CloudflareAccessAuthProvider } from '../auth/cloudflare-access-auth-provider';

// JWKS instances should be cached globally across requests for the same isolate
let authProviderCache: CloudflareAccessAuthProvider | null = null;

export function adminAuth() {
  return async (c: Context, next: Next) => {
    try {
      if (!authProviderCache) {
        authProviderCache = new CloudflareAccessAuthProvider({
          teamDomain: c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
          audience: c.env.CLOUDFLARE_ACCESS_AUD
        });
      }

      const identity = await authProviderCache.authenticate(c.req.raw);
      c.set('adminIdentity', identity);
      await next();
    } catch (error: any) {
      console.log(`[AdminAuth] Access denied: ${error.message || 'unknown'}`);
      return c.json({ error: 'unauthorized' }, 401);
    }
  };
}
