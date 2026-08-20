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

  async getAllNews(): Promise<News[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM news ORDER BY created_at DESC`
    );
    const { results } = await stmt.all<News>();
    return results;
  }

  async getNewsById(id: string): Promise<News | null> {
    const stmt = this.db.prepare(`SELECT * FROM news WHERE id = ?`);
    return await stmt.bind(id).first<News>();
  }

  async createNews(news: News): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO news (id, title, summary, image_url, target_url, published, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    await stmt.bind(
      news.id, news.title, news.summary ?? null, news.image_url ?? null, news.target_url ?? null,
      news.published ? 1 : 0, news.published_at ?? null, news.created_at, news.updated_at
    ).run();
  }

  async updateNews(id: string, updates: Partial<News>): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = ?`);
      // SQLite handles boolean as 0 or 1
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE news SET ${setClauses.join(', ')} WHERE id = ?`;
    await this.db.prepare(query).bind(...values).run();
  }

  async deleteNews(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM news WHERE id = ?`).bind(id).run();
  }
}
