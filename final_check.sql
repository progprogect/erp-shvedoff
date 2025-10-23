\echo '=== ФИНАЛЬНАЯ ПРОВЕРКА СИНХРОНИЗАЦИИ ==='

\echo 'BOTTOM_TYPES (должно быть 6):' 
SELECT count(*) as total_count FROM bottom_types;
SELECT id, code, name FROM bottom_types ORDER BY id;

\echo 'CARPET_EDGE_TYPES (должно быть 5):'
SELECT count(*) as total_count FROM carpet_edge_types;
SELECT id, name, code FROM carpet_edge_types ORDER BY id;

\echo 'ROLL_COVERING_COMPOSITION - Количество ограничений:'
SELECT count(*) as constraints_count 
FROM pg_constraint 
WHERE conrelid = 'roll_covering_composition'::regclass 
AND contype = 'c';

\echo 'ROLL_COVERING_COMPOSITION - Количество индексов:'
SELECT count(*) as indexes_count 
FROM pg_indexes 
WHERE tablename = 'roll_covering_composition';

\echo '=== ПРОВЕРКА ЗАВЕРШЕНА ==='














