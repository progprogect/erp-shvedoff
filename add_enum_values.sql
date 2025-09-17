-- Добавление новых значений в ENUM carpet_edge_type

\echo '=== ДОБАВЛЕНИЕ НОВЫХ ENUM ЗНАЧЕНИЙ ==='

-- Добавляем direct_cut (для Прямой рез)
ALTER TYPE carpet_edge_type ADD VALUE IF NOT EXISTS 'direct_cut';

-- Добавляем sub_puzzle (для Подпазл)  
ALTER TYPE carpet_edge_type ADD VALUE IF NOT EXISTS 'sub_puzzle';

-- Добавляем cast_puzzle (для Литой пазл)
ALTER TYPE carpet_edge_type ADD VALUE IF NOT EXISTS 'cast_puzzle';

\echo '--- Обновленный ENUM ---'
SELECT enumlabel as доступные_значения
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'carpet_edge_type'
ORDER BY e.enumsortorder;

\echo '=== ENUM ОБНОВЛЕН ==='





