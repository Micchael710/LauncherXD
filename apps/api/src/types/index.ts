export type Bindings = {
  DB: D1Database;
  GITHUB_OWNER: string;
  GITHUB_RELEASES_REPO: string;
  GITHUB_TOKEN?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
  CLOUDFLARE_ACCESS_AUD: string;
};

export type Release = {
  id: string;
  version: string;
  channel: string;
  release_type: string;
  status: string;
  github_tag?: string;
  github_release_id?: string;
  manifest_url?: string;
  total_size?: number;
  release_notes?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
};

export type ReleaseFile = {
  id: string;
  release_id: string;
  path: string;
  logical_path: string;
  filename: string;
  operation: string;
  size: number;
  sha256?: string;
  download_url?: string;
  github_asset_id?: string;
  part_index?: number;
  part_count?: number;
  final_sha256?: string;
  created_at: string;
};

export type News = {
  id: string;
  title: string;
  summary?: string;
  image_url?: string;
  target_url?: string;
  published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
};

export type LauncherSetting = {
  key: string;
  value: string;
  value_type: string;
  is_public: boolean;
  updated_at: string;
};

export type CreateReleaseInput = {
  version: string;
  channel: string;
  release_type: string;
  total_size?: number;
  release_notes?: string;
};

export type UpdateReleaseInput = {
  version?: string;
  channel?: string;
  release_type?: string;
  total_size?: number;
  release_notes?: string;
};

export type CreateReleaseFileInput = {
  path: string;
  logical_path: string;
  operation: string;
  size: number;
  sha256?: string;
  part_index?: number;
  part_count?: number;
  final_sha256?: string;
};

export type UpdateReleaseFileInput = {
  path?: string;
  logical_path?: string;
  operation?: string;
  size?: number;
  sha256?: string;
  part_index?: number;
  part_count?: number;
  final_sha256?: string;
};

export type CreateNewsInput = {
  title: string;
  summary?: string;
  image_url?: string;
  target_url?: string;
  published?: boolean;
};

export type UpdateNewsInput = {
  title?: string;
  summary?: string;
  image_url?: string;
  target_url?: string;
  published?: boolean;
};

export type UpdateSettingInput = {
  value: string;
  value_type: string;
  is_public?: boolean;
};
