-- Test valid inserts
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256) 
VALUES ('file-test-1', 'rel-1', 'mods/test.jar', 'mods/test.jar', 'test.jar', 'add', 100, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2');

-- Test invalid size (negative)
-- Expect error
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256) 
VALUES ('file-test-2', 'rel-1', 'mods/test2.jar', 'mods/test2.jar', 'test2.jar', 'add', -100, 'sha');

-- Test invalid operation
-- Expect error
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256) 
VALUES ('file-test-3', 'rel-1', 'mods/test3.jar', 'mods/test3.jar', 'test3.jar', 'explode', 100, 'sha');

-- Test invalid part constraints (index > count)
-- Expect error
INSERT INTO release_files (id, release_id, path, logical_path, filename, operation, size, sha256, part_index, part_count) 
VALUES ('file-test-4', 'rel-1', 'mods/test4.part02', 'test4.zip', 'test4.part02', 'add', 100, 'sha', 2, 1);

-- Test invalid status
-- Expect error
INSERT INTO releases (id, version, channel, release_type, status, total_size) 
VALUES ('rel-test-1', '3.0.0', 'stable', 'modpack', 'pepito', 1000);
