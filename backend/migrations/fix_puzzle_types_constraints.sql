-- Миграция для исправления ограничений в таблице puzzle_types
-- Дата: 2025-01-22
-- Описание: Добавление уникальных ограничений на поля name и code

BEGIN;

-- 1. Добавляем уникальное ограничение на поле name
ALTER TABLE puzzle_types 
ADD CONSTRAINT puzzle_types_name_unique UNIQUE (name);

-- 2. Добавляем уникальное ограничение на поле code
ALTER TABLE puzzle_types 
ADD CONSTRAINT puzzle_types_code_unique UNIQUE (code);

COMMIT;

-- Логирование выполнения миграции
SELECT 'Миграция fix_puzzle_types_constraints выполнена успешно' as status;



