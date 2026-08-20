-- Datos de prueba exclusivos para D1 LOCAL.
-- IMPORTANTE: Nunca ejecutar este script remotamente.
-- Ejecución: npx wrangler d1 execute launcherxd-db --local --file apps/api/seeds/local.sql

INSERT INTO releases (id, version, channel, release_type, status, total_size, published_at, created_at, updated_at) VALUES 
('rel-1', '1.0.0', 'stable', 'modpack', 'published', 1000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rel-2', '1.1.0', 'beta', 'modpack', 'published', 2000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('rel-3', '2.0.0', 'stable', 'modpack', 'draft', 3000000, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256, part_index, part_count, final_sha256) VALUES 
('file-1', 'rel-1', 'downloads/minecraft.part01', 'minecraft.zip', 'minecraft.part01', 'add', 500000, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 1, 3, 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'),
('file-2', 'rel-1', 'downloads/minecraft.part02', 'minecraft.zip', 'minecraft.part02', 'add', 500000, 'b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2d3e4f5a6b1c2', 2, 3, 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'),
('file-3', 'rel-1', 'downloads/minecraft.part03', 'minecraft.zip', 'minecraft.part03', 'add', 500000, 'c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2', 3, 3, 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'),
('file-4', 'rel-1', 'downloads/assets.part01', 'assets.zip', 'assets.part01', 'add', 200000, 'd1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2', 1, 2, 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'),
('file-5', 'rel-1', 'downloads/assets.part02', 'assets.zip', 'assets.part02', 'add', 200000, 'e1f2a3b4c5d6e1f2a3b4c5d6e1f2a3b4c5d6e1f2a3b4c5d6e1f2a3b4c5d6e1f2', 2, 2, 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'),
('file-6', 'rel-2', 'mods/create.jar', 'create.jar', 'create.jar', 'replace', 100000, 'f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2', NULL, NULL, NULL);

INSERT INTO news (id, title, summary, published, published_at, created_at, updated_at) VALUES 
('news-1', 'Welcome to LauncherXD', 'This is the first news', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('news-2', 'Draft News', 'This should not be seen', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO launcher_settings (key, value, value_type, is_public, updated_at) VALUES 
('maintenance_mode', 'false', 'boolean', 1, CURRENT_TIMESTAMP),
('internal_secret', 'should_be_hidden', 'string', 0, CURRENT_TIMESTAMP);
