-- =====================================================
-- ИСПРАВЛЕНИЕ: Триггер валидации планирования производства
-- =====================================================
-- Описание: Разрешает создание производственных заданий БЕЗ полей планирования
--          Это позволяет создавать заказы без автоматического планирования
-- =====================================================
-- Дата: 2025-10-01
-- Проблема: При создании заказа production_tasks создаются без дат планирования,
--          триггер блокирует это с ошибкой "dates are inconsistent"
-- Решение: Изменить функцию validate_production_planning - разрешить NULL значения
-- =====================================================

-- 1. Пересоздаем функцию валидации планирования
CREATE OR REPLACE FUNCTION validate_production_planning(
  p_planned_start_date TIMESTAMP,
  p_planned_end_date TIMESTAMP,
  p_estimated_duration_days INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  -- ✅ ИЗМЕНЕНИЕ: Разрешаем создание БЕЗ полей планирования
  -- Если все поля NULL - это валидно (задание создается без планирования)
  IF p_planned_start_date IS NULL AND p_planned_end_date IS NULL AND p_estimated_duration_days IS NULL THEN
    RETURN TRUE; -- ✅ Разрешено
  END IF;
  
  -- Если указаны обе даты - проверяем их корректность
  IF p_planned_start_date IS NOT NULL AND p_planned_end_date IS NOT NULL THEN
    -- Дата завершения должна быть >= дата начала (может быть одинаковой)
    IF p_planned_end_date < p_planned_start_date THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 2. Проверяем, что функция обновлена
SELECT 'Функция validate_production_planning успешно обновлена' as status;

-- 3. Тестируем функцию
DO $$
BEGIN
  -- Тест 1: NULL значения (должно пройти)
  IF NOT validate_production_planning(NULL, NULL, NULL) THEN
    RAISE EXCEPTION 'Тест 1 провален: NULL значения должны быть разрешены';
  ELSE
    RAISE NOTICE '✅ Тест 1 пройден: NULL значения разрешены';
  END IF;

  -- Тест 2: Корректные даты (должно пройти)
  IF NOT validate_production_planning(NOW(), NOW() + INTERVAL '7 days', NULL) THEN
    RAISE EXCEPTION 'Тест 2 провален: корректные даты должны быть разрешены';
  ELSE
    RAISE NOTICE '✅ Тест 2 пройден: корректные даты разрешены';
  END IF;

  -- Тест 3: Одинаковые даты (должно пройти)
  IF NOT validate_production_planning(NOW(), NOW(), NULL) THEN
    RAISE EXCEPTION 'Тест 3 провален: одинаковые даты должны быть разрешены';
  ELSE
    RAISE NOTICE '✅ Тест 3 пройден: одинаковые даты разрешены';
  END IF;

  -- Тест 4: Некорректные даты (должно провалиться)
  IF validate_production_planning(NOW(), NOW() - INTERVAL '1 day', NULL) THEN
    RAISE EXCEPTION 'Тест 4 провален: некорректные даты должны быть запрещены';
  ELSE
    RAISE NOTICE '✅ Тест 4 пройден: некорректные даты запрещены';
  END IF;

  RAISE NOTICE '✅ Все тесты пройдены успешно!';
END $$;

-- 4. Показываем информацию о триггере
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'tr_production_tasks_validate_planning';

-- =====================================================
-- ИНСТРУКЦИИ ПО ПРИМЕНЕНИЮ:
-- =====================================================
-- 1. Скопировать весь SQL скрипт
-- 2. Подключиться к Railway PostgreSQL через pgAdmin или psql
-- 3. Выполнить скрипт
-- 4. Проверить, что все тесты пройдены (зеленые галочки)
-- 5. Попробовать создать заказ снова
-- =====================================================

-- =====================================================
-- ОТКАТ (если нужно вернуть старую логику):
-- =====================================================
-- CREATE OR REPLACE FUNCTION validate_production_planning(
--   p_planned_start_date TIMESTAMP,
--   p_planned_end_date TIMESTAMP,
--   p_estimated_duration_days INTEGER
-- ) RETURNS BOOLEAN AS $$
-- BEGIN
--   -- Старая логика: минимум одно поле обязательно
--   IF p_planned_start_date IS NULL AND p_planned_end_date IS NULL AND p_estimated_duration_days IS NULL THEN
--     RETURN FALSE;
--   END IF;
--   
--   IF p_planned_start_date IS NOT NULL AND p_planned_end_date IS NOT NULL THEN
--     IF p_planned_end_date <= p_planned_start_date THEN
--       RETURN FALSE;
--     END IF;
--   END IF;
--   
--   RETURN TRUE;
-- END;
-- $$ LANGUAGE plpgsql;
-- =====================================================

COMMIT;
