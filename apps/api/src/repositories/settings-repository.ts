import { Bindings, LauncherSetting } from '../types';

export class SettingsRepository {
  constructor(private readonly db: D1Database) {}

  async getPublicSettings(): Promise<LauncherSetting[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM launcher_settings WHERE is_public = 1`
    );
    const { results } = await stmt.all<LauncherSetting>();
    return results;
  }

  async getAllSettings(): Promise<LauncherSetting[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM launcher_settings ORDER BY key ASC`
    );
    const { results } = await stmt.all<LauncherSetting>();
    return results;
  }

  async getSettingByKey(key: string): Promise<LauncherSetting | null> {
    const stmt = this.db.prepare(`SELECT * FROM launcher_settings WHERE key = ?`);
    return await stmt.bind(key).first<LauncherSetting>();
  }

  async upsertSetting(setting: LauncherSetting): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO launcher_settings (key, value, value_type, is_public, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         value_type = excluded.value_type,
         is_public = excluded.is_public,
         updated_at = excluded.updated_at`
    );
    await stmt.bind(
      setting.key, setting.value, setting.value_type,
      setting.is_public ? 1 : 0, setting.updated_at
    ).run();
  }
}
