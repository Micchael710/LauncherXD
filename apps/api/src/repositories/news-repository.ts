import { Bindings, News } from '../types';

export class NewsRepository {
  constructor(private readonly db: D1Database) {}

  async getPublishedNews(): Promise<News[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM news WHERE published = 1 ORDER BY published_at DESC`
    );
    const { results } = await stmt.all<News>();
    return results;
  }
}
