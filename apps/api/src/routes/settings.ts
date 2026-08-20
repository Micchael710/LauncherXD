import { Hono } from 'hono';
import { Bindings } from '../types';
import { SettingsRepository } from '../repositories/settings-repository';
import { SettingsService } from '../services/settings-service';

const settingsApp = new Hono<{ Bindings: Bindings }>();

settingsApp.get('/public', async (c) => {
  try {
    const service = new SettingsService(new SettingsRepository(c.env.DB));
    const settings = await service.getPublicSettings();
    return c.json(settings);
  } catch (err) {
    return c.json({ error: 'internal_error' }, 500);
  }
});

export { settingsApp };
