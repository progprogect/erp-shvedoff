-- Получение размеров таблиц (исправленная версия)
SELECT 
    schemaname,
    tablename,
    n_live_tup as rows_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;


