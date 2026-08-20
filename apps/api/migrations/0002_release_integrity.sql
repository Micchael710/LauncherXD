-- apps/api/migrations/0002_release_integrity.sql

-- RELEASES: Añadir constraints de integridad
CREATE TABLE releases_new (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    channel TEXT NOT NULL,
    release_type TEXT NOT NULL CHECK (release_type IN ('launcher', 'modpack')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'deprecated')),
    github_tag TEXT,
    github_release_id TEXT,
    manifest_url TEXT,
    total_size INTEGER CHECK (total_size >= 0 OR total_size IS NULL),
    release_notes TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO releases_new SELECT * FROM releases;
DROP TABLE releases;
ALTER TABLE releases_new RENAME TO releases;

CREATE UNIQUE INDEX idx_releases_version_channel_type ON releases (version, channel, release_type);
CREATE INDEX idx_releases_channel ON releases (channel);
CREATE INDEX idx_releases_status ON releases (status);
CREATE INDEX idx_releases_release_type ON releases (release_type);
CREATE INDEX idx_releases_published_at ON releases (published_at DESC);

-- RELEASE_FILES: Añadir logical_path y constraints
CREATE TABLE release_files_new (
    id TEXT PRIMARY KEY,
    release_id TEXT NOT NULL,
    path TEXT NOT NULL,
    logical_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('add', 'replace', 'delete')),
    size INTEGER NOT NULL CHECK (size >= 0),
    sha256 TEXT,
    download_url TEXT,
    github_asset_id TEXT,
    part_index INTEGER CHECK (part_index >= 1 OR part_index IS NULL),
    part_count INTEGER CHECK (part_count >= 1 OR part_count IS NULL),
    final_sha256 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    CHECK (
        (part_index IS NULL AND part_count IS NULL) OR 
        (part_index IS NOT NULL AND part_count IS NOT NULL AND part_index <= part_count)
    )
);

-- Copiar datos existentes, usando filename como valor por defecto para logical_path
INSERT INTO release_files_new (
    id, release_id, path, logical_path, filename, operation, size, sha256, 
    download_url, github_asset_id, part_index, part_count, final_sha256, created_at
)
SELECT 
    id, release_id, path, filename, filename, operation, size, sha256, 
    download_url, github_asset_id, part_index, part_count, final_sha256, created_at
FROM release_files;

DROP TABLE release_files;
ALTER TABLE release_files_new RENAME TO release_files;

CREATE INDEX idx_release_files_release_id ON release_files (release_id);
