-- Миграция для добавления логотипа SHVEDOFF
-- Дата: 2025-01-22
-- Описание: Добавление логотипа SHVEDOFF в справочник product_logos

BEGIN;

-- Добавляем логотип SHVEDOFF
INSERT INTO product_logos (name, description, is_system, created_at) VALUES
('SHVEDOFF', 'Логотип бренда SHVEDOFF', true, NOW())
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция add_shvedoff_logo выполнена успешно' as status;



