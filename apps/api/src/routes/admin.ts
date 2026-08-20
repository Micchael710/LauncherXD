import { Hono } from 'hono';

const adminApp = new Hono<{ Variables: { adminIdentity: import('../auth/admin-auth-provider').AdminIdentity } }>();

adminApp.get('/health', (c) => {
  const identity = c.get('adminIdentity');
  
  return c.json({
    status: 'ok',
    admin: 'authenticated',
    subject: identity.subject,
    email: identity.email
  });
});

export default adminApp;
