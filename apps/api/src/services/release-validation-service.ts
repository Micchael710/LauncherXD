import { Release, ReleaseFile } from "../types";
import { validateReleaseFilesConsistency } from "../utils/validation";

export class ReleaseValidationService {
  static validate(release: Release, files: ReleaseFile[]): { valid: boolean; issues: any[] } {
    const issues: any[] = [];

    // Check release metadata
    if (!release.version) issues.push({ code: "missing_version" });
    if (!release.channel) issues.push({ code: "missing_channel" });
    if (!release.release_type) issues.push({ code: "missing_release_type" });

    // Try validating files
    try {
      validateReleaseFilesConsistency(files);
    } catch (err: any) {
      issues.push({
        code: "file_consistency_error",
        message: err.message
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
