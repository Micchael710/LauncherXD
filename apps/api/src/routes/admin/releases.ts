import { Hono } from 'hono';
import { Bindings, CreateReleaseInput, UpdateReleaseInput } from '../../types';
import { ReleaseRepository } from '../../repositories/release-repository';
import { isValidSemVer } from '../../utils/validation';
import { AdminAuditLogger } from '../../services/admin-audit-logger';
import { AdminIdentity } from '../../auth/admin-auth-provider';
import { ReleaseValidationService } from '../../services/release-validation-service';
import releaseFilesApp from './release-files';

const releasesApp = new Hono<{ Bindings: Bindings, Variables: { adminIdentity: AdminIdentity } }>();

releasesApp.get('/', async (c) => {
  const repo = new ReleaseRepository(c.env.DB);
  const releases = await repo.getAllReleases(true);
  return c.json({ value: releases, Count: releases.length });
});

releasesApp.post('/', async (c) => {
  let body: CreateReleaseInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  if (!isValidSemVer(body.version)) return c.json({ error: 'validation_error', details: ['invalid_version'] }, 400);
  if (!['stable', 'beta'].includes(body.channel)) return c.json({ error: 'validation_error', details: ['invalid_channel'] }, 400);
  if (!['launcher', 'modpack'].includes(body.release_type)) return c.json({ error: 'validation_error', details: ['invalid_release_type'] }, 400);
  if (body.total_size !== undefined && (typeof body.total_size !== 'number' || body.total_size < 0)) return c.json({ error: 'validation_error', details: ['invalid_total_size'] }, 400);
  if (body.release_notes !== undefined && body.release_notes.length > 50000) return c.json({ error: 'validation_error', details: ['notes_too_long'] }, 400);

  const id = crypto.randomUUID();
  const repo = new ReleaseRepository(c.env.DB);

  try {
    await repo.createRelease({
      id,
      version: body.version,
      channel: body.channel,
      release_type: body.release_type,
      status: 'draft',
      total_size: body.total_size,
      release_notes: body.release_notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    AdminAuditLogger.logAction(c.get('adminIdentity'), 'releases', id, 'create', 'success');
    return c.json({ id, status: 'created' }, 201);
  } catch (err: any) {
    if (err.message === 'conflict') {
      return c.json({ error: 'conflict', details: ['duplicate_release'] }, 409);
    }
    throw err;
  }
});

releasesApp.get('/:id', async (c) => {
  const id = c.req.param('id');
  const repo = new ReleaseRepository(c.env.DB);
  const release = await repo.getReleaseById(id);

  if (!release) return c.json({ error: 'not_found' }, 404);
  return c.json(release);
});

releasesApp.patch('/:id', async (c) => {
  const id = c.req.param('id');
  let body: UpdateReleaseInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  const repo = new ReleaseRepository(c.env.DB);
  const existing = await repo.getReleaseById(id);

  if (!existing) return c.json({ error: 'not_found' }, 404);
  if (existing.status === 'published') return c.json({ error: 'conflict', details: ['cannot_edit_published'] }, 409);
  if (existing.status === 'deprecated') return c.json({ error: 'conflict', details: ['cannot_edit_deprecated'] }, 409);

  const updates: any = {};
  if (body.version !== undefined) {
    if (!isValidSemVer(body.version)) return c.json({ error: 'validation_error', details: ['invalid_version'] }, 400);
    updates.version = body.version;
  }
  if (body.channel !== undefined) {
    if (!['stable', 'beta'].includes(body.channel)) return c.json({ error: 'validation_error', details: ['invalid_channel'] }, 400);
    updates.channel = body.channel;
  }
  if (body.release_type !== undefined) {
    if (!['launcher', 'modpack'].includes(body.release_type)) return c.json({ error: 'validation_error', details: ['invalid_release_type'] }, 400);
    updates.release_type = body.release_type;
  }
  if (body.total_size !== undefined) {
    if (typeof body.total_size !== 'number' || body.total_size < 0) return c.json({ error: 'validation_error', details: ['invalid_total_size'] }, 400);
    updates.total_size = body.total_size;
  }
  if (body.release_notes !== undefined) {
    if (body.release_notes && body.release_notes.length > 50000) return c.json({ error: 'validation_error', details: ['notes_too_long'] }, 400);
    updates.release_notes = body.release_notes;
  }

  try {
    await repo.updateRelease(id, updates);
    AdminAuditLogger.logAction(c.get('adminIdentity'), 'releases', id, 'update', 'success');
    return c.json({ status: 'ok' });
  } catch (err: any) {
    if (err.message === 'conflict') {
      return c.json({ error: 'conflict', details: ['duplicate_release'] }, 409);
    }
    throw err;
  }
});

releasesApp.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const repo = new ReleaseRepository(c.env.DB);

  const existing = await repo.getReleaseById(id);
  if (!existing) return c.json({ error: 'not_found' }, 404);
  if (existing.status !== 'draft') return c.json({ error: 'conflict', details: ['only_drafts_can_be_deleted'] }, 409);

  await repo.deleteRelease(id);
  AdminAuditLogger.logAction(c.get('adminIdentity'), 'releases', id, 'delete', 'success');
  return c.json({ status: 'ok' });
});

releasesApp.get('/:id/validation', async (c) => {
  const id = c.req.param('id');
  const repo = new ReleaseRepository(c.env.DB);

  const release = await repo.getReleaseById(id);
  if (!release) return c.json({ error: 'not_found' }, 404);

  const files = await repo.getReleaseFiles(id);
  const result = ReleaseValidationService.validate(release, files);

  return c.json(result);
});

// Mount nested routes for release files
releasesApp.route('/:releaseId/files', releaseFilesApp);

export default releasesApp;
