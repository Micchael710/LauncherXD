import { Release, ReleaseFile } from "../types";
import { validateReleaseReady } from "../utils/validation";

export class ReleaseValidationService {
  static validate(release: Release, files: ReleaseFile[]): { valid: boolean; issues: any[] } {
    const issues = validateReleaseReady(release, files);

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
