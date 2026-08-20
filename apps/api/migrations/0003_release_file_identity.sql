-- apps/api/migrations/0003_release_file_identity.sql

-- 1. Evitar path duplicados dentro de una misma release
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_files_release_path 
ON release_files (release_id, path);

-- 2. Evitar partes multipart duplicadas para un mismo archivo lógico
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_files_multipart 
ON release_files (release_id, logical_path, part_index)
WHERE part_index IS NOT NULL;
