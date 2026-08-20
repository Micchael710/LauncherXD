import { jwtVerify, createRemoteJWKSet } from 'jose';
import { AdminAuthProvider, AdminIdentity } from './admin-auth-provider';

export interface CloudflareAccessConfig {
  teamDomain: string;
  audience: string;
}

export class CloudflareAccessAuthProvider implements AdminAuthProvider {
  private config: CloudflareAccessConfig;
  private jwks: any;

  constructor(config: CloudflareAccessConfig) {
    this.config = config;
    if (this.config.teamDomain) {
      this.jwks = createRemoteJWKSet(new URL(`https://${this.config.teamDomain}/cdn-cgi/access/certs`));
    }
  }

  async authenticate(request: Request): Promise<AdminIdentity> {
    if (!this.config.teamDomain || !this.config.audience) {
      throw new Error('missing_access_config');
    }

    const token = request.headers.get('cf-access-jwt-assertion');
    if (!token) {
      throw new Error('missing_token');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `https://${this.config.teamDomain}`,
        audience: this.config.audience,
        algorithms: ['RS256'] // Explicitly restrict algorithm to prevent alg=none
      });

      if (!payload.sub) {
        throw new Error('missing_subject');
      }

      return {
        subject: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined
      };
    } catch (error: any) {
      // Catch all jose errors (signature, expiration, audience, issuer, network/jwks) and fail closed.
      throw new Error('invalid_token');
    }
  }
}
