import { Hono } from 'hono';
import { Bindings, CreateReleaseFileInput, UpdateReleaseFileInput } from '../../types';
import { ReleaseRepository } from '../../repositories/release-repository';
import { isSafePath, isValidSha256, validateIndividualFileConsistency } from '../../utils/validation';
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
    return c.json({ error: 'validation_error', details: [{ code: 'invalid_json' }] }, 400);
  }

  // Derive filename from path server-side
  const pathSegments = (body.path || '').split('/');
  const filename = pathSegments[pathSegments.length - 1];

  const candidate = {
    ...body,
    filename,
    operation: body.operation
  };

  try {
    validateIndividualFileConsistency(candidate);
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return c.json({ error: 'validation_error', details: err.details }, 400);
    }
    throw err;
  }

  if (!['add', 'replace', 'delete'].includes(body.operation)) return c.json({ error: 'validation_error', details: [{ code: 'invalid_operation' }] }, 400);
  if (typeof body.size !== 'number' || body.size < 0) return c.json({ error: 'validation_error', details: [{ code: 'invalid_size' }] }, 400);

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

  const currentFile = await repo.getReleaseFileById(fileId, releaseId);
  if (!currentFile) return c.json({ error: 'not_found' }, 404);

  let body: UpdateReleaseFileInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'validation_error', details: [{ code: 'invalid_json' }] }, 400);
  }

  const candidate = {
    ...currentFile,
    ...body
  };

  if (body.path !== undefined) {
    const pathSegments = (body.path || '').split('/');
    candidate.filename = pathSegments[pathSegments.length - 1];
  }

  try {
    validateIndividualFileConsistency(candidate);
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return c.json({ error: 'validation_error', details: err.details }, 400);
    }
    throw err;
  }

  if (body.operation !== undefined && !['add', 'replace', 'delete'].includes(body.operation)) return c.json({ error: 'validation_error', details: [{ code: 'invalid_operation' }] }, 400);
  if (body.size !== undefined && (typeof body.size !== 'number' || body.size < 0)) return c.json({ error: 'validation_error', details: [{ code: 'invalid_size' }] }, 400);

  const updates: any = {};
  if (body.path !== undefined) {
    updates.path = candidate.path;
    updates.filename = candidate.filename;
  }
  if (body.logical_path !== undefined) updates.logical_path = candidate.logical_path;
  if (body.operation !== undefined) updates.operation = candidate.operation;
  if (body.size !== undefined) updates.size = candidate.size;
  if (body.sha256 !== undefined) updates.sha256 = candidate.sha256;
  if (body.part_index !== undefined) updates.part_index = candidate.part_index;
  if (body.part_count !== undefined) updates.part_count = candidate.part_count;
  if (body.final_sha256 !== undefined) updates.final_sha256 = candidate.final_sha256;

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

  const currentFile = await repo.getReleaseFileById(fileId, releaseId);
  if (!currentFile) return c.json({ error: 'not_found' }, 404);

  await repo.deleteReleaseFile(fileId, releaseId);
  AdminAuditLogger.logAction(c.get('adminIdentity'), 'release_files', fileId, 'delete', 'success', { release_id: releaseId });

  return c.json({ status: 'ok' });
});

export default releaseFilesApp;
