-- Миграция: Добавление таблицы для промежуточных результатов резки
-- Дата: 2025-10-17
-- Описание: Создание таблицы cutting_progress_log для хранения промежуточных результатов операций резки

-- Создаем таблицу для промежуточных результатов резки
CREATE TABLE IF NOT EXISTS cutting_progress_log (
    id SERIAL PRIMARY KEY,
    operation_id INTEGER NOT NULL REFERENCES cutting_operations(id) ON DELETE CASCADE,
    product_quantity INTEGER DEFAULT 0,
    second_grade_quantity INTEGER DEFAULT 0,
    waste_quantity INTEGER DEFAULT 0,
    entered_at TIMESTAMP DEFAULT NOW(),
    entered_by INTEGER NOT NULL REFERENCES users(id)
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_cutting_progress_log_operation_id ON cutting_progress_log(operation_id);
CREATE INDEX IF NOT EXISTS idx_cutting_progress_log_entered_at ON cutting_progress_log(entered_at);
CREATE INDEX IF NOT EXISTS idx_cutting_progress_log_entered_by ON cutting_progress_log(entered_by);

-- Добавляем комментарии к таблице и колонкам
COMMENT ON TABLE cutting_progress_log IS 'Лог промежуточных результатов операций резки';
COMMENT ON COLUMN cutting_progress_log.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN cutting_progress_log.operation_id IS 'ID операции резки';
COMMENT ON COLUMN cutting_progress_log.product_quantity IS 'Количество готового товара (может быть отрицательным для корректировки)';
COMMENT ON COLUMN cutting_progress_log.second_grade_quantity IS 'Количество товара 2-го сорта (может быть отрицательным для корректировки)';
COMMENT ON COLUMN cutting_progress_log.waste_quantity IS 'Количество брака (может быть отрицательным для корректировки)';
COMMENT ON COLUMN cutting_progress_log.entered_at IS 'Дата и время ввода результатов';
COMMENT ON COLUMN cutting_progress_log.entered_by IS 'ID пользователя, введшего результаты';

-- Создаем функцию для получения текущего прогресса операции
CREATE OR REPLACE FUNCTION get_cutting_operation_progress(operation_id_param INTEGER)
RETURNS TABLE (
    total_product_quantity INTEGER,
    total_second_grade_quantity INTEGER,
    total_waste_quantity INTEGER,
    last_updated TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(cpl.product_quantity), 0)::INTEGER as total_product_quantity,
        COALESCE(SUM(cpl.second_grade_quantity), 0)::INTEGER as total_second_grade_quantity,
        COALESCE(SUM(cpl.waste_quantity), 0)::INTEGER as total_waste_quantity,
        MAX(cpl.entered_at) as last_updated
    FROM cutting_progress_log cpl
    WHERE cpl.operation_id = operation_id_param;
END;
$$ LANGUAGE plpgsql;

-- Создаем представление для удобного получения прогресса операций
CREATE OR REPLACE VIEW cutting_operations_with_progress AS
SELECT 
    co.*,
    COALESCE(progress.total_product_quantity, 0) as current_product_quantity,
    COALESCE(progress.total_second_grade_quantity, 0) as current_second_grade_quantity,
    COALESCE(progress.total_waste_quantity, 0) as current_waste_quantity,
    progress.last_updated as progress_last_updated
FROM cutting_operations co
LEFT JOIN LATERAL get_cutting_operation_progress(co.id) as progress ON true;

-- Добавляем комментарий к представлению
COMMENT ON VIEW cutting_operations_with_progress IS 'Операции резки с информацией о текущем прогрессе';

-- Создаем триггер для автоматического обновления остатков на складе при добавлении прогресса
CREATE OR REPLACE FUNCTION update_stock_from_cutting_progress()
RETURNS TRIGGER AS $$
DECLARE
    _source_product_id INTEGER;
    _target_product_id INTEGER;
    _second_grade_product_id INTEGER;
    _liberty_grade_product_id INTEGER;
    _target_product_name VARCHAR;
    _product_diff INTEGER;
    _second_grade_diff INTEGER;
    _liberty_grade_diff INTEGER;
    _waste_diff INTEGER;
    _total_produced_diff INTEGER;
    _source_quantity INTEGER;
    _user_id INTEGER;
    _operation_id INTEGER;
BEGIN
    -- Определяем operation_id в зависимости от типа операции
    IF TG_OP = 'DELETE' THEN
        _operation_id := OLD.operation_id;
    ELSE
        _operation_id := NEW.operation_id;
    END IF;

    -- Получаем информацию об операции резки
    SELECT co.source_product_id, co.target_product_id, co.source_quantity, co.operator_id, p.name 
    INTO _source_product_id, _target_product_id, _source_quantity, _user_id, _target_product_name
    FROM cutting_operations co
    LEFT JOIN products p ON p.id = co.target_product_id
    WHERE co.id = _operation_id;

    -- Товары 2-го сорта и Либерти теперь создаются в API endpoint с правильными характеристиками
    -- Здесь мы только обновляем остатки для уже существующих товаров
    _second_grade_product_id := NULL;
    _liberty_grade_product_id := NULL;

    -- Вычисляем разность для обновления остатков
    IF TG_OP = 'INSERT' THEN
        _product_diff := NEW.product_quantity;
        _second_grade_diff := NEW.second_grade_quantity;
        _liberty_grade_diff := NEW.liberty_grade_quantity;
        _waste_diff := NEW.waste_quantity;
    ELSIF TG_OP = 'UPDATE' THEN
        _product_diff := NEW.product_quantity - OLD.product_quantity;
        _second_grade_diff := NEW.second_grade_quantity - OLD.second_grade_quantity;
        _liberty_grade_diff := NEW.liberty_grade_quantity - OLD.liberty_grade_quantity;
        _waste_diff := NEW.waste_quantity - OLD.waste_quantity;
    ELSE -- DELETE
        _product_diff := -OLD.product_quantity;
        _second_grade_diff := -OLD.second_grade_quantity;
        _liberty_grade_diff := -OLD.liberty_grade_quantity;
        _waste_diff := -OLD.waste_quantity;
    END IF;

    -- Вычисляем общее количество произведенного товара (готовый + 2 сорт + Либерти + брак)
    _total_produced_diff := _product_diff + _second_grade_diff + _liberty_grade_diff + _waste_diff;

    -- Списываем исходный товар пропорционально произведенному количеству
    IF _total_produced_diff != 0 THEN
        UPDATE stock 
        SET 
            current_stock = current_stock - _total_produced_diff,
            updated_at = NOW()
        WHERE product_id = _source_product_id;

        -- Логируем списание исходного товара
        INSERT INTO stock_movements (
            product_id, 
            movement_type, 
            quantity, 
            reference_id, 
            reference_type, 
            comment, 
            user_id
        ) VALUES (
            _source_product_id,
            'cutting_out'::movement_type,
            ABS(_total_produced_diff),
            _operation_id,
            'cutting_progress',
            'Списание исходного товара по операции резки #' || _operation_id || ' (прогресс: товар=' || _product_diff || ', 2сорт=' || _second_grade_diff || ', Либерти=' || _liberty_grade_diff || ', брак=' || _waste_diff || ')',
            _user_id
        );
    END IF;

    -- Обновляем остатки для готового товара
    IF _product_diff != 0 THEN
        UPDATE stock 
        SET 
            current_stock = current_stock + _product_diff,
            updated_at = NOW()
        WHERE product_id = _target_product_id;

        -- Логируем движение товара
        INSERT INTO stock_movements (
            product_id, 
            movement_type, 
            quantity, 
            reference_id, 
            reference_type, 
            comment, 
            user_id
        ) VALUES (
            _target_product_id,
            (CASE WHEN _product_diff > 0 THEN 'cutting_in' ELSE 'outgoing' END)::movement_type,
            ABS(_product_diff),
            _operation_id,
            'cutting_progress',
            'Корректировка готового товара по операции резки #' || _operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    -- Товары 2-го сорта и Либерти создаются в API endpoint с правильными характеристиками
    -- Trigger функция только обновляет остатки готового товара и списывает исходный товар
    
    -- Возвращаем правильную запись в зависимости от типа операции
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматического обновления времени изменения операции при добавлении прогресса
CREATE OR REPLACE FUNCTION update_cutting_operation_on_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Просто возвращаем NEW без обновления updated_at, так как этой колонки нет в cutting_operations
    -- В будущем можно добавить колонку updated_at в таблицу cutting_operations если потребуется
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cutting_operation_on_progress
    AFTER INSERT ON cutting_progress_log
    FOR EACH ROW
    EXECUTE FUNCTION update_cutting_operation_on_progress();

CREATE TRIGGER trigger_update_stock_from_cutting_progress
    AFTER INSERT OR UPDATE OR DELETE ON cutting_progress_log
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_from_cutting_progress();

-- Создаем функцию для валидации прогресса (проверка, что операция не завершена)
CREATE OR REPLACE FUNCTION validate_cutting_progress()
RETURNS TRIGGER AS $$
DECLARE
    operation_status TEXT;
BEGIN
    -- Получаем статус операции
    SELECT status INTO operation_status 
    FROM cutting_operations 
    WHERE id = NEW.operation_id;
    
    -- Проверяем, что операция не завершена
    IF operation_status = 'completed' THEN
        RAISE EXCEPTION 'Нельзя добавлять прогресс для завершенной операции резки';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_cutting_progress
    BEFORE INSERT ON cutting_progress_log
    FOR EACH ROW
    EXECUTE FUNCTION validate_cutting_progress();

-- Логируем создание миграции
INSERT INTO audit_log (table_name, record_id, operation, new_values, created_at)
VALUES (
    'cutting_progress_log', 
    0, 
    'INSERT', 
    '{"table": "cutting_progress_log", "description": "Таблица для промежуточных результатов операций резки"}',
    NOW()
);
