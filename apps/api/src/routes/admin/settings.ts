import { Hono } from 'hono';
import { Bindings, UpdateSettingInput } from '../../types';
import { SettingsRepository } from '../../repositories/settings-repository';
import { isSafeSettingKey } from '../../utils/validation';
import { AdminAuditLogger } from '../../services/admin-audit-logger';
import { AdminIdentity } from '../../auth/admin-auth-provider';

const settingsApp = new Hono<{ Bindings: Bindings, Variables: { adminIdentity: AdminIdentity } }>();

settingsApp.get('/', async (c) => {
  const repo = new SettingsRepository(c.env.DB);
  const settings = await repo.getAllSettings();
  return c.json({ value: settings, Count: settings.length });
});

settingsApp.put('/:key', async (c) => {
  const key = c.req.param('key');
  if (!isSafeSettingKey(key)) {
    return c.json({ error: 'validation_error', details: ['invalid_or_unsafe_key'] }, 400);
  }

  let body: UpdateSettingInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  if (!body.value || !body.value_type) {
    return c.json({ error: 'validation_error', details: ['missing_required_fields'] }, 400);
  }

  if (body.value_type === 'boolean') {
    if (body.value !== 'true' && body.value !== 'false') {
      return c.json({ error: 'validation_error', details: ['invalid_boolean_value'] }, 400);
    }
  } else if (body.value_type === 'number') {
    if (isNaN(Number(body.value))) {
      return c.json({ error: 'validation_error', details: ['invalid_number_value'] }, 400);
    }
  }

  const repo = new SettingsRepository(c.env.DB);
  await repo.upsertSetting({
    key,
    value: body.value,
    value_type: body.value_type,
    is_public: body.is_public === true,
    updated_at: new Date().toISOString()
  });

  AdminAuditLogger.logAction(c.get('adminIdentity'), 'launcher_settings', key, 'upsert', 'success');

  return c.json({ status: 'ok' });
});

export default settingsApp;
