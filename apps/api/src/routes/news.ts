import { Hono } from 'hono';
import { Bindings } from '../types';
import { NewsRepository } from '../repositories/news-repository';
import { NewsService } from '../services/news-service';

const newsApp = new Hono<{ Bindings: Bindings }>();

newsApp.get('/', async (c) => {
  try {
    const service = new NewsService(new NewsRepository(c.env.DB));
    const news = await service.getPublishedNews();
    return c.json(news);
  } catch (err) {
    return c.json({ error: 'internal_error' }, 500);
  }
});

export { newsApp };

