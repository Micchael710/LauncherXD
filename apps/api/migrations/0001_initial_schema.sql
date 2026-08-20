-- PASO 3: releases
CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    channel TEXT NOT NULL,
    release_type TEXT NOT NULL,
    status TEXT NOT NULL,
    github_tag TEXT,
    github_release_id TEXT,
    manifest_url TEXT,
    total_size INTEGER,
    release_notes TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_releases_version_channel_type ON releases (version, channel, release_type);
CREATE INDEX IF NOT EXISTS idx_releases_channel ON releases (channel);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases (status);
CREATE INDEX IF NOT EXISTS idx_releases_release_type ON releases (release_type);
CREATE INDEX IF NOT EXISTS idx_releases_published_at ON releases (published_at DESC);

-- PASO 4 y 5: release_files
CREATE TABLE IF NOT EXISTS release_files (
    id TEXT PRIMARY KEY,
    release_id TEXT NOT NULL,
    path TEXT NOT NULL,
    filename TEXT NOT NULL,
    operation TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT,
    download_url TEXT,
    github_asset_id TEXT,
    part_index INTEGER,
    part_count INTEGER,
    final_sha256 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_release_files_release_id ON release_files (release_id);

-- PASO 6: news
CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    image_url TEXT,
    target_url TEXT,
    published BOOLEAN DEFAULT 0,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_published_date ON news (published, published_at DESC);

-- PASO 7: launcher_settings
CREATE TABLE IF NOT EXISTS launcher_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL,
    is_public BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_launcher_settings_public ON launcher_settings (is_public);
