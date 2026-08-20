import { Bindings, Release, ReleaseFile } from '../types';

export class ReleaseRepository {
  constructor(private readonly db: D1Database) {}

  async getLatestRelease(channel: string, releaseType: string): Promise<Release | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM releases 
       WHERE channel = ? AND release_type = ? AND status = 'published' 
       ORDER BY published_at DESC LIMIT 1`
    );
    return await stmt.bind(channel, releaseType).first<Release>();
  }

  async getReleaseByVersion(version: string, channel: string, releaseType: string): Promise<Release | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM releases 
       WHERE version = ? AND channel = ? AND release_type = ? AND status != 'draft'`
    );
    return await stmt.bind(version, channel, releaseType).first<Release>();
  }

  async getReleaseFiles(releaseId: string): Promise<ReleaseFile[]> {
    const stmt = this.db.prepare(`SELECT * FROM release_files WHERE release_id = ?`);
    const { results } = await stmt.bind(releaseId).all<ReleaseFile>();
    return results;
  }
}
