import { ReleaseRepository } from '../repositories/release-repository';
import { validateReleaseFilesConsistency } from '../utils/validation';

export class ReleaseService {
  constructor(private readonly repository: ReleaseRepository) {}

  async getLatestRelease(channel: string, releaseType: string) {
    if (!channel || !releaseType) {
      throw new Error('channel and type are required');
    }
    const release = await this.repository.getLatestRelease(channel, releaseType);
    if (!release) return null;
    return this.mapReleaseToPublic(release);
  }

  async getReleaseByVersion(version: string, channel: string, releaseType: string) {
    if (!version || !channel || !releaseType) {
      throw new Error('version, channel, and type are required');
    }
    const release = await this.repository.getReleaseByVersion(version, channel, releaseType);
    if (!release) return null;
    return this.mapReleaseToPublic(release);
  }

  async getReleaseManifest(version: string, channel: string, releaseType: string) {
    if (!version || !channel || !releaseType) {
      throw new Error('version, channel, and type are required');
    }
    const release = await this.repository.getReleaseByVersion(version, channel, releaseType);
    if (!release) return null;

    const files = await this.repository.getReleaseFiles(release.id);
    validateReleaseFilesConsistency(files);
    
    return {
      version: release.version,
      channel: release.channel,
      type: release.release_type,
      totalSize: release.total_size,
      files: files.map(f => ({
        path: f.path,
        logicalPath: f.logical_path,
        operation: f.operation,
        size: f.size,
        sha256: f.sha256,
        downloadUrl: f.download_url,
        partIndex: f.part_index,
        partCount: f.part_count,
        finalSha256: f.final_sha256
      }))
    };
  }

  private mapReleaseToPublic(release: any) {
    return {
      version: release.version,
      channel: release.channel,
      type: release.release_type,
      totalSize: release.total_size,
      releaseNotes: release.release_notes,
      publishedAt: release.published_at,
    };
  }
}
