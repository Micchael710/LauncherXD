import { describe, it, expect } from 'vitest';
import { isSafePath, isValidSha256, validateReleaseFilesConsistency, validateIndividualFileConsistency, isValidSemVer, isValidNewsUrl, isSafeSettingKey } from '../../utils/validation';

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
    expect(isSafeSettingKey('my_secret')).toBe(false);
    expect(isSafeSettingKey('jwt_key')).toBe(false);
  });

  it('validateReleaseFilesConsistency checks ready-to-publish state', () => {
    const validFiles = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) },
      { path: 'b', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 2, part_count: 2, final_sha256: 'b'.repeat(64) }
    ];
    expect(() => validateReleaseFilesConsistency(validFiles)).not.toThrow();

    const missingParts = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) }
    ];
    expect(() => validateReleaseFilesConsistency(missingParts)).toThrow(/Missing parts in multipart group/);

    const duplicateParts = [
      { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) },
      { path: 'b', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) }
    ];
    expect(() => validateReleaseFilesConsistency(duplicateParts)).toThrow(/Duplicate part_index/);
  });

  it('validateIndividualFileConsistency allows incomplete multipart', () => {
    const incomplete = { path: 'a', logical_path: 'a', operation: 'add', sha256: 'a'.repeat(64), part_index: 1, part_count: 2, final_sha256: 'b'.repeat(64) };
    expect(() => validateIndividualFileConsistency(incomplete)).not.toThrow();
  });
});
