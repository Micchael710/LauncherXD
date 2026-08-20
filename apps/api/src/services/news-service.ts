import { NewsRepository } from '../repositories/news-repository';

export class NewsService {
  constructor(private readonly repository: NewsRepository) {}

  async getPublishedNews() {
    const news = await this.repository.getPublishedNews();
    return news.map(n => ({
      title: n.title,
      summary: n.summary,
      imageUrl: n.image_url,
      targetUrl: n.target_url,
      publishedAt: n.published_at,
    }));
  }
}
