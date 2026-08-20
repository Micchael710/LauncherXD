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
}
