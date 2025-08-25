-- Проверка возможности создания бэкапа
SELECT 'BACKUP TEST' as status;
SELECT current_database() as db_name;
SELECT version() as pg_version;
SELECT pg_size_pretty(pg_database_size(current_database())) as db_size;


