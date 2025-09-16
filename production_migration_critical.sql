-- =====================================================
-- КРИТИЧЕСКИЕ МИГРАЦИИ ДЛЯ PRODUCTION БД
-- =====================================================
-- ВНИМАНИЕ: Этот скрипт только ДОБАВЛЯЕТ структуру, НЕ УДАЛЯЕТ данные!
-- Дата: $(date)
-- Описание: Добавление критически важных полей и последовательностей

-- =====================================================
-- 1. ДОБАВЛЕНИЕ ПОЛЯ contract_number В ТАБЛИЦУ orders
-- =====================================================

-- Проверяем, существует ли уже поле contract_number
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'contract_number'
    ) THEN
        -- Добавляем поле contract_number
        ALTER TABLE orders 
        ADD COLUMN contract_number VARCHAR(100);
        
        -- Добавляем комментарий к полю
        COMMENT ON COLUMN orders.contract_number IS 'Номер договора клиента';
        
        RAISE NOTICE 'Поле contract_number добавлено в таблицу orders';
    ELSE
        RAISE NOTICE 'Поле contract_number уже существует в таблице orders';
    END IF;
END $$;

-- =====================================================
-- 2. СОЗДАНИЕ ПОСЛЕДОВАТЕЛЬНОСТИ ДЛЯ НОМЕРОВ ЗАКАЗОВ
-- =====================================================

-- Проверяем, существует ли уже последовательность
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.sequences 
        WHERE sequence_name = 'order_number_sequence'
    ) THEN
        -- Создаем последовательность для номеров заказов
        CREATE SEQUENCE order_number_sequence
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;
        
        -- Добавляем комментарий к последовательности
        COMMENT ON SEQUENCE order_number_sequence IS 'Последовательность для генерации номеров заказов';
        
        RAISE NOTICE 'Последовательность order_number_sequence создана';
    ELSE
        RAISE NOTICE 'Последовательность order_number_sequence уже существует';
    END IF;
END $$;

-- =====================================================
-- 3. ПРОВЕРКА РЕЗУЛЬТАТА
-- =====================================================

-- Проверяем, что поле contract_number добавлено
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'contract_number'
        ) THEN '✅ Поле contract_number добавлено'
        ELSE '❌ Ошибка: поле contract_number не найдено'
    END as contract_number_status;

-- Проверяем, что последовательность создана
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.sequences 
            WHERE sequence_name = 'order_number_sequence'
        ) THEN '✅ Последовательность order_number_sequence создана'
        ELSE '❌ Ошибка: последовательность order_number_sequence не найдена'
    END as sequence_status;

-- Показываем текущую структуру таблицы orders
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- Показываем информацию о последовательности
SELECT 
    sequence_name,
    start_value,
    minimum_value,
    maximum_value,
    increment
FROM information_schema.sequences 
WHERE sequence_name = 'order_number_sequence';

-- Миграция завершена успешно!
