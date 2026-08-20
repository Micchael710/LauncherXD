import { Hono } from 'hono';
import { Bindings, CreateReleaseFileInput, UpdateReleaseFileInput } from '../../types';
import { ReleaseRepository } from '../../repositories/release-repository';
import { isSafePath, isValidSha256 } from '../../utils/validation';
import { AdminAuditLogger } from '../../services/admin-audit-logger';
import { AdminIdentity } from '../../auth/admin-auth-provider';

// This app is mounted at /api/admin/releases/:releaseId/files
const releaseFilesApp = new Hono<{ Bindings: Bindings, Variables: { adminIdentity: AdminIdentity } }>();

releaseFilesApp.get('/', async (c) => {
  const releaseId = c.req.param('releaseId')!;
  const repo = new ReleaseRepository(c.env.DB);

  const release = await repo.getReleaseById(releaseId);
  if (!release) return c.json({ error: 'not_found' }, 404);

  const files = await repo.getReleaseFiles(releaseId);
  return c.json({ value: files, Count: files.length });
});

releaseFilesApp.post('/', async (c) => {
  const releaseId = c.req.param('releaseId')!;
  const repo = new ReleaseRepository(c.env.DB);

  const release = await repo.getReleaseById(releaseId);
  if (!release) return c.json({ error: 'not_found' }, 404);

  if (release.status !== 'draft') {
    return c.json({ error: 'conflict', details: ['release_not_draft'] }, 409);
  }

  let body: CreateReleaseFileInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  if (!isSafePath(body.path)) return c.json({ error: 'validation_error', details: ['invalid_path'] }, 400);
  if (!isSafePath(body.logical_path)) return c.json({ error: 'validation_error', details: ['invalid_logical_path'] }, 400);
  if (!['add', 'replace', 'delete'].includes(body.operation)) return c.json({ error: 'validation_error', details: ['invalid_operation'] }, 400);
  if (typeof body.size !== 'number' || body.size < 0) return c.json({ error: 'validation_error', details: ['invalid_size'] }, 400);

  if ((body.operation === 'add' || body.operation === 'replace') && !isValidSha256(body.sha256)) {
    return c.json({ error: 'validation_error', details: ['invalid_sha256'] }, 400);
  }

  // Derive filename from path server-side
  const pathSegments = body.path.split('/');
  const filename = pathSegments[pathSegments.length - 1];

  const fileId = crypto.randomUUID();
  try {
    await repo.addReleaseFile({
      id: fileId,
      release_id: releaseId,
      path: body.path,
      logical_path: body.logical_path,
      filename,
      operation: body.operation,
      size: body.size,
      sha256: body.sha256,
      part_index: body.part_index,
      part_count: body.part_count,
      final_sha256: body.final_sha256,
      created_at: new Date().toISOString()
    });
    AdminAuditLogger.logAction(c.get('adminIdentity'), 'release_files', fileId, 'add', 'success', { release_id: releaseId });
    return c.json({ id: fileId, status: 'created' }, 201);
  } catch (err: any) {
    if (err.message === 'conflict') {
      return c.json({ error: 'conflict', details: ['duplicate_file_or_part'] }, 409);
    }
    throw err;
  }
});

releaseFilesApp.patch('/:fileId', async (c) => {
  const releaseId = c.req.param('releaseId')!;
  const fileId = c.req.param('fileId')!;
  const repo = new ReleaseRepository(c.env.DB);

  const release = await repo.getReleaseById(releaseId);
  if (!release) return c.json({ error: 'not_found' }, 404);

  if (release.status !== 'draft') {
    return c.json({ error: 'conflict', details: ['release_not_draft'] }, 409);
  }

  let body: UpdateReleaseFileInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: ['invalid_json'] }, 400);
  }

  const updates: any = {};

  if (body.path !== undefined) {
    if (!isSafePath(body.path)) return c.json({ error: 'validation_error', details: ['invalid_path'] }, 400);
    updates.path = body.path;
    const pathSegments = body.path.split('/');
    updates.filename = pathSegments[pathSegments.length - 1];
  }
  if (body.logical_path !== undefined) {
    if (!isSafePath(body.logical_path)) return c.json({ error: 'validation_error', details: ['invalid_logical_path'] }, 400);
    updates.logical_path = body.logical_path;
  }
  if (body.operation !== undefined) {
    if (!['add', 'replace', 'delete'].includes(body.operation)) return c.json({ error: 'validation_error', details: ['invalid_operation'] }, 400);
    updates.operation = body.operation;
  }
  if (body.size !== undefined) {
    if (typeof body.size !== 'number' || body.size < 0) return c.json({ error: 'validation_error', details: ['invalid_size'] }, 400);
    updates.size = body.size;
  }
  if (body.sha256 !== undefined) {
    if (body.sha256 && !isValidSha256(body.sha256)) return c.json({ error: 'validation_error', details: ['invalid_sha256'] }, 400);
    updates.sha256 = body.sha256;
  }
  if (body.part_index !== undefined) updates.part_index = body.part_index;
  if (body.part_count !== undefined) updates.part_count = body.part_count;
  if (body.final_sha256 !== undefined) {
    if (body.final_sha256 && !isValidSha256(body.final_sha256)) return c.json({ error: 'validation_error', details: ['invalid_final_sha256'] }, 400);
    updates.final_sha256 = body.final_sha256;
  }

  try {
    await repo.updateReleaseFile(fileId, releaseId, updates);
    AdminAuditLogger.logAction(c.get('adminIdentity'), 'release_files', fileId, 'update', 'success', { release_id: releaseId });
    return c.json({ status: 'ok' });
  } catch (err: any) {
    if (err.message === 'conflict') {
      return c.json({ error: 'conflict', details: ['duplicate_file_or_part'] }, 409);
    }
    throw err;
  }
});

releaseFilesApp.delete('/:fileId', async (c) => {
  const releaseId = c.req.param('releaseId')!;
  const fileId = c.req.param('fileId')!;
  const repo = new ReleaseRepository(c.env.DB);

  const release = await repo.getReleaseById(releaseId);
  if (!release) return c.json({ error: 'not_found' }, 404);

  if (release.status !== 'draft') {
    return c.json({ error: 'conflict', details: ['release_not_draft'] }, 409);
  }

  await repo.deleteReleaseFile(fileId, releaseId);
  AdminAuditLogger.logAction(c.get('adminIdentity'), 'release_files', fileId, 'delete', 'success', { release_id: releaseId });

  return c.json({ status: 'ok' });
});

export default releaseFilesApp;
