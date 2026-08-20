import { describe, it, expect } from 'vitest';
import { isSafePath, isValidSha256, validateReleaseReady, validateIndividualFileConsistency, isValidSemVer, isValidNewsUrl, isSafeSettingKey, ValidationError } from '../../utils/validation';

describe('Validation Utilities', () => {
  it('isSafePath allows safe paths', () => {
    expect(isSafePath('mods/create.jar')).toBe(true);
    expect(isSafePath('config/test.toml')).toBe(true);
  });

  it('isSafePath rejects traversal and absolute paths', () => {
    expect(isSafePath('../secret')).toBe(false);
    expect(isSafePath('../../file')).toBe(false);
    expect(isSafePath('/absolute')).toBe(false);
    expect(isSafePath('C:\\Windows\\file')).toBe(false);
    expect(isSafePath('C:/Windows/file')).toBe(false);
    expect(isSafePath('mods/../../../file')).toBe(false);
    expect(isSafePath('./file')).toBe(false);
    expect(isSafePath('mods/../file')).toBe(false);
    expect(isSafePath('\\\\server\\share')).toBe(false);
    expect(isSafePath('mods//file')).toBe(false); // empty segment
  });

  it('isSafePath rejects Windows reserved names, ADS, trailing dot/space', () => {
    expect(isSafePath('mods/NUL')).toBe(false);
    expect(isSafePath('mods/nul.jar')).toBe(false);
    expect(isSafePath('mods/CON.txt')).toBe(false);
    expect(isSafePath('mods/PRN')).toBe(false);
    expect(isSafePath('mods/AUX.cfg')).toBe(false);
    expect(isSafePath('mods/COM1.dat')).toBe(false);
    expect(isSafePath('mods/COM9')).toBe(false);
    expect(isSafePath('mods/LPT1.txt')).toBe(false);
    expect(isSafePath('mods/LPT9')).toBe(false);
    expect(isSafePath('mods/file.jar:stream')).toBe(false);
    expect(isSafePath('mods/test.')).toBe(false);
    expect(isSafePath('mods/test ')).toBe(false);
  });

  it('isValidSha256 validates hashes correctly', () => {
    const valid = 'a'.repeat(64);
    expect(isValidSha256(valid)).toBe(true);
    expect(isValidSha256('a'.repeat(63))).toBe(false);
    expect(isValidSha256('a'.repeat(65))).toBe(false);
    expect(isValidSha256('g' + 'a'.repeat(63))).toBe(false);
  });

  it('isValidSemVer works correctly', () => {
    expect(isValidSemVer('1.0.0')).toBe(true);
    expect(isValidSemVer('1.2.3-beta.1')).toBe(true);
    expect(isValidSemVer('invalid')).toBe(false);
  });

  it('isValidNewsUrl works correctly', () => {
    expect(isValidNewsUrl('https://example.com')).toBe(true);
    expect(isValidNewsUrl('http://example.com')).toBe(true);
    expect(isValidNewsUrl('javascript:alert(1)')).toBe(false);
    expect(isValidNewsUrl('file:///C:/')).toBe(false);
    expect(isValidNewsUrl('data:text/html,<html>')).toBe(false);
  });

  it('isSafeSettingKey works correctly', () => {
    expect(isSafeSettingKey('launcher_title')).toBe(true);
    expect(isSafeSettingKey('discord_url')).toBe(true);
    expect(isSafeSettingKey('GITHUB_TOKEN')).toBe(false);
    expect(isSafeSettingKey('github_token')).toBe(false);
    expect(isSafeSettingKey('CLOUDFLARE_ACCESS_AUD')).toBe(false);
    expect(isSafeSettingKey('cloudflare_access_team_domain')).toBe(false);
    expect(isSafeSettingKey('PASSWORD')).toBe(false);
    expect(isSafeSettingKey('SECRET')).toBe(false);
    expect(isSafeSettingKey('API_KEY')).toBe(false);
    expect(isSafeSettingKey('PRIVATE_KEY')).toBe(false);
    expect(isSafeSettingKey('JWT')).toBe(false);
    expect(isSafeSettingKey('CREDENTIAL')).toBe(false);
    expect(isSafeSettingKey('AUTHORIZATION')).toBe(false);
    expect(isSafeSettingKey('my_secret')).toBe(false);
  });

  it('validateReleaseReady checks ready-to-publish state', () => {
    const release = { version: '1.0.0', channel: 'stable', release_type: 'launcher', total_size: 2 };
    const validFiles = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) },
      { path: 'b', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 2, part_count: 2, final_sha256: 'b'.repeat(64) }
    ];
    expect(validateReleaseReady(release, validFiles)).toEqual([]);

    const missingParts = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) }
    ];
    const missingRes = validateReleaseReady(release, missingParts);
    expect(missingRes).toContainEqual(expect.objectContaining({ code: 'multipart_missing_part' }));

    const duplicateParts = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) },
      { path: 'b', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) }
    ];
    const duplicateRes = validateReleaseReady(release, duplicateParts);
    expect(duplicateRes).toContainEqual(expect.objectContaining({ code: 'duplicate_part_index' }));

    const inconsistentFinalSha = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) },
      { path: 'b', logical_path: 'a', operation: 'add', sha256: 'c'.repeat(64), part_index: 2, part_count: 2, final_sha256: 'd'.repeat(64) }
    ];
    const inconsistentRes = validateReleaseReady(release, inconsistentFinalSha);
    expect(inconsistentRes).toContainEqual(expect.objectContaining({ code: 'inconsistent_final_sha256' }));
  });

  it('validateIndividualFileConsistency boundaries (part_index=0, etc)', () => {
    try {
      validateIndividualFileConsistency({ path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 0, part_count: 2, final_sha256: 'b'.repeat(64) });
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e.details.map((d: any) => d.code)).toContain('invalid_part_index');
    }

    try {
      validateIndividualFileConsistency({ path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 0, final_sha256: 'b'.repeat(64) });
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e.details.map((d: any) => d.code)).toContain('invalid_part_count');
    }

    try {
      validateIndividualFileConsistency({ path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'invalid' });
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e.details.map((d: any) => d.code)).toContain('invalid_final_sha256');
    }
  });

  it('validateIndividualFileConsistency throws ValidationError with structured issues', () => {
    const incomplete = { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) };
    expect(() => validateIndividualFileConsistency(incomplete)).not.toThrow();

    const invalid = { path: 'mods/..', logical_path: 'a', operation: 'add', sha256: 'bad', part_index: 5, part_count: 2, final_sha256: 'b'.repeat(64) };
    try {
      validateIndividualFileConsistency(invalid);
      expect.fail('Should have thrown ValidationError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ValidationError);
      const codes = e.details.map((d: any) => d.code);
      expect(codes).toContain('invalid_sha256');
      expect(codes).toContain('part_index_exceeds_count');
      expect(codes).toContain('invalid_path');
    }
  });
});
