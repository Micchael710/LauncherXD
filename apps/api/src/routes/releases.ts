import { Hono } from 'hono';
import { Bindings } from '../types';
import { ReleaseRepository } from '../repositories/release-repository';
import { ReleaseService } from '../services/release-service';

const releasesApp = new Hono<{ Bindings: Bindings }>();

// Factory helper
const getService = (db: D1Database) => new ReleaseService(new ReleaseRepository(db));

releasesApp.get('/latest', async (c) => {
  try {
    const channel = c.req.query('channel');
    const type = c.req.query('type');
    
    if (!channel || !type) {
      return c.json({ error: 'bad_request', message: 'channel and type query parameters are required' }, 400);
    }
    
    const service = getService(c.env.DB);
    const release = await service.getLatestRelease(channel, type);
    
    if (!release) {
      return c.json({ error: 'release_not_found' }, 404);
    }
    
    return c.json(release);
  } catch (err) {
    return c.json({ error: 'internal_error' }, 500);
  }
});

releasesApp.get('/:version', async (c) => {
  try {
    const version = c.req.param('version');
    const channel = c.req.query('channel');
    const type = c.req.query('type');
    
    if (!channel || !type) {
      return c.json({ error: 'bad_request', message: 'channel and type query parameters are required' }, 400);
    }

    const service = getService(c.env.DB);
    const release = await service.getReleaseByVersion(version, channel, type);
    
    if (!release) {
      return c.json({ error: 'release_not_found' }, 404);
    }
    
    return c.json(release);
  } catch (err) {
    return c.json({ error: 'internal_error' }, 500);
  }
});

releasesApp.get('/:version/manifest', async (c) => {
  try {
    const version = c.req.param('version');
    const channel = c.req.query('channel');
    const type = c.req.query('type');
    
    if (!channel || !type) {
      return c.json({ error: 'bad_request', message: 'channel and type query parameters are required' }, 400);
    }

    const service = getService(c.env.DB);
    const manifest = await service.getReleaseManifest(version, channel, type);
    
    if (!manifest) {
      return c.json({ error: 'release_not_found' }, 404);
    }
    
    return c.json(manifest);
  } catch (err) {
    return c.json({ error: 'internal_error' }, 500);
  }
});

export { releasesApp };
