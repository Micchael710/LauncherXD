-- Duplicate path in the same release
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256) 
VALUES ('file-dup-1', 'rel-1', 'mods/dup.jar', 'mods/dup.jar', 'dup.jar', 'add', 100, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

-- Duplicate path (expect error due to idx_release_files_release_path)
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256) 
VALUES ('file-dup-2', 'rel-1', 'mods/dup.jar', 'mods/dup.jar', 'dup.jar', 'add', 100, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

-- Valid multipart
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256, part_index, part_count, final_sha256) 
VALUES ('file-dup-3', 'rel-1', 'downloads/dup.part01', 'dup.zip', 'dup.part01', 'add', 100, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 1, 3, 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1');

-- Duplicate part_index (expect error due to idx_release_files_multipart)
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256, part_index, part_count, final_sha256) 
VALUES ('file-dup-4', 'rel-1', 'downloads/dup_alt.part01', 'dup.zip', 'dup_alt.part01', 'add', 100, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 1, 3, 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1');
