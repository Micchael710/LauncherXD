import { SettingsRepository } from '../repositories/settings-repository';

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async getPublicSettings() {
    const settings = await this.repository.getPublicSettings();
    return settings.map(s => ({
      key: s.key,
      value: s.value,
      type: s.value_type,
    }));
  }
}
