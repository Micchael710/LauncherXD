import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudflareAccessAuthProvider } from '../cloudflare-access-auth-provider';
import * as jose from 'jose';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn().mockReturnValue('mock-jwks'),
  jwtVerify: vi.fn(),
}));

describe('CloudflareAccessAuthProvider', () => {
  const config = {
    teamDomain: 'test.cloudflareaccess.com',
    audience: 'test-audience',
  };

  let provider: CloudflareAccessAuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new CloudflareAccessAuthProvider(config);
  });

  it('should throw if config is missing', async () => {
    const badProvider = new CloudflareAccessAuthProvider({ teamDomain: '', audience: '' });
    await expect(badProvider.authenticate({ headers: new Map() } as any)).rejects.toThrow('missing_access_config');
  });

  it('should throw if token is missing', async () => {
    const request = {
      headers: new Map(),
    } as any;
    // @ts-ignore
    request.headers.get = (name) => null;

    await expect(provider.authenticate(request)).rejects.toThrow('missing_token');
  });

  it('should authenticate successfully with valid token', async () => {
    const request = {
      headers: new Map(),
    } as any;
    // @ts-ignore
    request.headers.get = (name) => {
      if (name === 'cf-access-jwt-assertion') return 'valid-token';
      return null;
    };

    (jose.jwtVerify as any).mockResolvedValue({
      payload: {
        sub: 'user-id-123',
        email: 'admin@example.com',
      },
    });

    const identity = await provider.authenticate(request);
    
    expect(jose.jwtVerify).toHaveBeenCalledWith(
      'valid-token',
      'mock-jwks',
      {
        issuer: 'https://test.cloudflareaccess.com',
        audience: 'test-audience',
        algorithms: ['RS256']
      }
    );
    expect(identity.subject).toBe('user-id-123');
    expect(identity.email).toBe('admin@example.com');
  });

  it('should throw invalid_token if signature is invalid', async () => {
    const request = { headers: { get: () => 'bad-token' } } as any;
    (jose.jwtVerify as any).mockRejectedValue(new Error('signature verification failed'));
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });

  it('should throw invalid_token if token is expired', async () => {
    const request = { headers: { get: () => 'expired-token' } } as any;
    (jose.jwtVerify as any).mockRejectedValue(new Error('expired'));
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });

  it('should throw invalid_token if issuer is incorrect', async () => {
    const request = { headers: { get: () => 'token' } } as any;
    (jose.jwtVerify as any).mockRejectedValue(new Error('issuer'));
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });

  it('should throw invalid_token if audience is incorrect', async () => {
    const request = { headers: { get: () => 'token' } } as any;
    (jose.jwtVerify as any).mockRejectedValue(new Error('audience'));
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });

  it('should throw invalid_token if sub is missing', async () => {
    const request = { headers: { get: () => 'token' } } as any;
    (jose.jwtVerify as any).mockResolvedValue({ payload: { email: 'admin@example.com' } });
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });

  it('should throw invalid_token if algorithm is unexpected (e.g. none)', async () => {
    const request = { headers: { get: () => 'token' } } as any;
    (jose.jwtVerify as any).mockRejectedValue(new Error('alg not allowed'));
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });

  it('should fail closed if JWKS endpoint fails', async () => {
    const request = { headers: { get: () => 'token' } } as any;
    (jose.jwtVerify as any).mockRejectedValue(new Error('network error'));
    await expect(provider.authenticate(request)).rejects.toThrow('invalid_token');
  });
});
