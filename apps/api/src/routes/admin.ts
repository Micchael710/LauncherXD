import { Hono } from 'hono';
import releasesApp from './admin/releases';
import newsApp from './admin/news';
import settingsApp from './admin/settings';

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

adminApp.route('/releases', releasesApp);
adminApp.route('/news', newsApp);
adminApp.route('/settings', settingsApp);

export default adminApp;
