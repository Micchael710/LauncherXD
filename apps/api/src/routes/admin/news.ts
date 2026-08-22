import { Hono } from 'hono';
import { Bindings, CreateNewsInput, UpdateNewsInput } from '../../types';
import { NewsRepository } from '../../repositories/news-repository';
import { isValidNewsUrl, isValidNewsVideoUrl } from '../../utils/validation';
import { AdminAuditLogger } from '../../services/admin-audit-logger';
import { AdminIdentity } from '../../auth/admin-auth-provider';

const newsApp = new Hono<{ Bindings: Bindings, Variables: { adminIdentity: AdminIdentity } }>();

newsApp.get('/', async (c) => {
  const repo = new NewsRepository(c.env.DB);
  const news = await repo.getAllNews();
  return c.json({ value: news, Count: news.length });
});

newsApp.post('/', async (c) => {
  let body: CreateNewsInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  if (!body.title || body.title.length > 200) {
    return c.json({ error: 'validation_error', details: ['invalid_title'] }, 400);
  }

  if (body.summary && body.summary.length > 1000) {
    return c.json({ error: 'validation_error', details: ['summary_too_long'] }, 400);
  }

  const hasImage = Boolean(body.image_url && body.image_url.trim());
  const hasVideo = Boolean(body.video_url && body.video_url.trim());

  if (hasImage && hasVideo) {
    return c.json({ error: 'validation_error', details: ['cannot_have_both_image_and_video'] }, 400);
  }

  if (body.image_url && !isValidNewsUrl(body.image_url)) {
    return c.json({ error: 'validation_error', details: ['invalid_image_url'] }, 400);
  }

  if (body.video_url && !isValidNewsVideoUrl(body.video_url)) {
    return c.json({ error: 'validation_error', details: ['invalid_video_url'] }, 400);
  }

  if (body.target_url && !isValidNewsUrl(body.target_url)) {
    return c.json({ error: 'validation_error', details: ['invalid_target_url'] }, 400);
  }

  const id = crypto.randomUUID();
  const repo = new NewsRepository(c.env.DB);

  await repo.createNews({
    id,
    title: body.title,
    summary: body.summary,
    image_url: body.image_url || undefined,
    video_url: body.video_url || null,
    target_url: body.target_url,
    published: body.published === true,
    published_at: body.published ? new Date().toISOString() : undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  AdminAuditLogger.logAction(c.get('adminIdentity'), 'news', id, 'create', 'success');

  return c.json({ id, status: 'created' }, 201);
});

newsApp.patch('/:id', async (c) => {
  const id = c.req.param('id');
  let body: UpdateNewsInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  const repo = new NewsRepository(c.env.DB);
  const existing = await repo.getNewsById(id);
  if (!existing) {
    return c.json({ error: 'not_found' }, 404);
  }

  const updates: any = {};

  if (body.title !== undefined) {
    if (!body.title || body.title.length > 200) return c.json({ error: 'validation_error', details: ['invalid_title'] }, 400);
    updates.title = body.title;
  }

  if (body.summary !== undefined) {
    if (body.summary && body.summary.length > 1000) return c.json({ error: 'validation_error', details: ['summary_too_long'] }, 400);
    updates.summary = body.summary;
  }

  if (body.image_url !== undefined) {
    if (body.image_url && !isValidNewsUrl(body.image_url)) return c.json({ error: 'validation_error', details: ['invalid_image_url'] }, 400);
    updates.image_url = body.image_url ? body.image_url : null;
  }

  if (body.video_url !== undefined) {
    if (body.video_url && !isValidNewsVideoUrl(body.video_url)) return c.json({ error: 'validation_error', details: ['invalid_video_url'] }, 400);
    updates.video_url = body.video_url ? body.video_url : null;
  }

  const effectiveImageUrl = updates.image_url !== undefined ? updates.image_url : existing.image_url;
  const effectiveVideoUrl = updates.video_url !== undefined ? updates.video_url : existing.video_url;

  const hasEffectiveImage = Boolean(effectiveImageUrl && effectiveImageUrl.trim());
  const hasEffectiveVideo = Boolean(effectiveVideoUrl && effectiveVideoUrl.trim());

  if (hasEffectiveImage && hasEffectiveVideo) {
    return c.json({ error: 'validation_error', details: ['cannot_have_both_image_and_video'] }, 400);
  }

  if (body.target_url !== undefined) {
    if (body.target_url && !isValidNewsUrl(body.target_url)) return c.json({ error: 'validation_error', details: ['invalid_target_url'] }, 400);
    updates.target_url = body.target_url;
  }

  if (body.published !== undefined) {
    updates.published = body.published;
    if (body.published && !existing.published) {
      updates.published_at = new Date().toISOString();
    } else if (!body.published) {
      updates.published_at = null;
    }
  }

  await repo.updateNews(id, updates);
  AdminAuditLogger.logAction(c.get('adminIdentity'), 'news', id, 'update', 'success');

  return c.json({ status: 'ok' });
});

newsApp.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const repo = new NewsRepository(c.env.DB);

  const existing = await repo.getNewsById(id);
  if (!existing) {
    return c.json({ error: 'not_found' }, 404);
  }

  await repo.deleteNews(id);
  AdminAuditLogger.logAction(c.get('adminIdentity'), 'news', id, 'delete', 'success');

  return c.json({ status: 'ok' });
});

export default newsApp;
