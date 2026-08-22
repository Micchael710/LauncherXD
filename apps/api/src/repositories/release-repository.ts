import { Bindings, Release, ReleaseFile } from '../types';

export class ReleaseRepository {
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

  async getReleaseFileById(fileId: string, releaseId: string): Promise<ReleaseFile | null> {
    const stmt = this.db.prepare(`SELECT * FROM release_files WHERE id = ? AND release_id = ?`);
    const file = await stmt.bind(fileId, releaseId).first<ReleaseFile>();
    return file;
  }

  constructor(private readonly db: D1Database) {}

  async getAllReleases(includeDrafts: boolean): Promise<Release[]> {
    let query = `SELECT * FROM releases ORDER BY created_at DESC`;
    if (!includeDrafts) {
      query = `SELECT * FROM releases WHERE status != 'draft' ORDER BY created_at DESC`;
    }
    const stmt = this.db.prepare(query);
    const { results } = await stmt.all<Release>();
    return results;
  }

  async getReleaseById(id: string): Promise<Release | null> {
    const stmt = this.db.prepare(`SELECT * FROM releases WHERE id = ?`);
    return await stmt.bind(id).first<Release>();
  }

  async createRelease(release: Release): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO releases (id, version, channel, release_type, status, total_size, release_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      await stmt.bind(
        release.id, release.version, release.channel, release.release_type,
        release.status, release.total_size ?? null, release.release_notes ?? null,
        release.created_at, release.updated_at
      ).run();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed') || msg === 'conflict') {
        throw new Error('conflict');
      }
      throw err;
    }
  }

  async updateRelease(id: string, updates: Partial<Release>): Promise<void> {
    const setClauses: string[] = [];
    const values: (string | number | boolean | null | undefined)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id); // For the WHERE clause

    const query = `UPDATE releases SET ${setClauses.join(', ')} WHERE id = ?`;
    try {
      await this.db.prepare(query).bind(...values).run();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed') || msg === 'conflict') {
        throw new Error('conflict');
      }
      throw err;
    }
  }

  async deleteRelease(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM releases WHERE id = ? AND status = 'draft'`).bind(id).run();
  }

  async purgeRelease(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM releases WHERE id = ?`).bind(id).run();
  }

  async addReleaseFile(file: ReleaseFile): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256, part_index, part_count, final_sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      await stmt.bind(
        file.id, file.release_id, file.path, file.logical_path, file.filename,
        file.operation, file.size, file.sha256 ?? null,
        file.part_index ?? null, file.part_count ?? null, file.final_sha256 ?? null,
        file.created_at
      ).run();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed') || msg === 'conflict') {
        throw new Error('conflict');
      }
      throw err;
    }
  }

  async updateReleaseFile(releaseId: string, fileId: string, updates: Partial<ReleaseFile>): Promise<void> {
    const setClauses: string[] = [];
    const values: (string | number | boolean | null | undefined)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }

    if (setClauses.length === 0) return;

    values.push(fileId);
    values.push(releaseId);

    const query = `UPDATE release_files SET ${setClauses.join(', ')} WHERE id = ? AND release_id = ?`;
    try {
      await this.db.prepare(query).bind(...values).run();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed') || msg === 'conflict') {
        throw new Error('conflict');
      }
      throw err;
    }
  }

  async deleteReleaseFile(fileId: string, releaseId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM release_files WHERE id = ? AND release_id = ?`).bind(fileId, releaseId).run();
  }
}
