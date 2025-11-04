-- Полная синхронизация справочников production → staging
-- Staging = ЭТАЛОН
-- Дата: $(date)

BEGIN;

\echo '=== СИНХРОНИЗАЦИЯ СПРАВОЧНИКОВ С STAGING ==='

-- 1. СИНХРОНИЗАЦИЯ BOTTOM_TYPES
\echo '--- Синхронизация bottom_types ---'

-- Удаляем все записи, которых нет в staging
DELETE FROM bottom_types WHERE id NOT IN (1, 2, 3, 4, 5, 6);

-- Обновляем/добавляем записи точно как в staging
INSERT INTO bottom_types (id, code, name, description, is_system, created_at) VALUES 
  (1, 'spike_0', 'Шип-0', 'Низ ковра - Шип-0 (без шипов)', true, now()),
  (2, 'spike_2', 'Шип-2', '2 шипа', true, now()),
  (3, 'spike_5', 'Шип-5', '5 шипов', true, now()),
  (4, 'spike_7', 'Шип-7', '7 шипов', true, now()),
  (5, 'spike_11', 'Шип-11', '11 шипов', true, now()),
  (6, 'not_selected', 'Не выбрано', 'Низ ковра не выбран', true, now())
ON CONFLICT (id) DO UPDATE SET 
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- 2. СИНХРОНИЗАЦИЯ CARPET_EDGE_TYPES
\echo '--- Синхронизация carpet_edge_types ---'

-- Удаляем все записи, которых нет в staging
DELETE FROM carpet_edge_types WHERE id NOT IN (1, 2, 3, 4, 5);

-- Обновляем/добавляем записи точно как в staging
INSERT INTO carpet_edge_types (id, name, code, description, is_system, created_at) VALUES 
  (1, 'Прямой рез', 'direct_cut', 'Обычный прямой край ковра', false, now()),
  (2, 'Паззл', 'puzzle', 'Паззловый край ковра с дополнительными опциями', false, now()),
  (3, 'Подпазл', 'sub_puzzle', 'Тип края ковра - подпазл', false, now()),
  (4, 'Литой пазл', 'cast_puzzle', 'Тип края ковра - литой пазл', false, now()),
  (5, 'Литой', 'straight_cut', 'Литой край ковра (по умолчанию)', false, now())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- 3. ПРОВЕРКА РЕЗУЛЬТАТОВ
\echo '--- ПРОВЕРКА РЕЗУЛЬТАТОВ ---'

\echo 'BOTTOM_TYPES:'
SELECT id, code, name, description, is_system FROM bottom_types ORDER BY id;

\echo 'CARPET_EDGE_TYPES:'
SELECT id, name, code, description, is_system FROM carpet_edge_types ORDER BY id;

\echo '=== СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА ==='

COMMIT;
















