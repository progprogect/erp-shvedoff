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
BEGIN
    -- Получаем информацию об операции резки
    SELECT co.source_product_id, co.target_product_id, co.source_quantity, co.operator_id, p.name 
    INTO _source_product_id, _target_product_id, _source_quantity, _user_id, _target_product_name
    FROM cutting_operations co
    LEFT JOIN products p ON p.id = co.target_product_id
    WHERE co.id = NEW.operation_id;

    -- Определяем ID товара 2-го сорта (если он существует)
    SELECT p.id INTO _second_grade_product_id
    FROM products p
    WHERE p.name = _target_product_name AND p.grade = 'grade_2' AND p.is_active = TRUE;

    -- Определяем ID товара сорта Либерти (если он существует)
    SELECT p.id INTO _liberty_grade_product_id
    FROM products p
    WHERE p.name = _target_product_name AND p.grade = 'liber' AND p.is_active = TRUE;

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
            NEW.operation_id,
            'cutting_progress',
            'Списание исходного товара по операции резки #' || NEW.operation_id || ' (прогресс: товар=' || _product_diff || ', 2сорт=' || _second_grade_diff || ', Либерти=' || _liberty_grade_diff || ', брак=' || _waste_diff || ')',
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
            NEW.operation_id,
            'cutting_progress',
            'Корректировка готового товара по операции резки #' || NEW.operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    -- Обновляем остатки для товара 2-го сорта
    IF _second_grade_diff != 0 THEN
        -- Если товара 2-го сорта нет, создаем его
        IF _second_grade_product_id IS NULL THEN
            INSERT INTO products (
                name, 
                article, 
                category_id, 
                product_type, 
                grade, 
                is_active, 
                notes
            ) VALUES (
                _target_product_name, 
                '2S-' || _target_product_name, 
                (SELECT category_id FROM products WHERE id = _target_product_id), 
                (SELECT product_type FROM products WHERE id = _target_product_id), 
                'grade_2', 
                TRUE, 
                'Автоматически создан для 2-го сорта по операции резки #' || NEW.operation_id
            ) RETURNING id INTO _second_grade_product_id;

            -- Создаем запись остатков для нового товара
            INSERT INTO stock (product_id, current_stock, reserved_stock)
            VALUES (_second_grade_product_id, 0, 0);
        END IF;

        UPDATE stock 
        SET 
            current_stock = current_stock + _second_grade_diff,
            updated_at = NOW()
        WHERE product_id = _second_grade_product_id;

        -- Логируем движение товара 2-го сорта
        INSERT INTO stock_movements (
            product_id, 
            movement_type, 
            quantity, 
            reference_id, 
            reference_type, 
            comment, 
            user_id
        ) VALUES (
            _second_grade_product_id,
            (CASE WHEN _second_grade_diff > 0 THEN 'cutting_in' ELSE 'outgoing' END)::movement_type,
            ABS(_second_grade_diff),
            NEW.operation_id,
            'cutting_progress',
            'Корректировка 2-го сорта по операции резки #' || NEW.operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    -- Обновляем остатки для товара сорта Либерти
    IF _liberty_grade_diff != 0 THEN
        -- Если товара сорта Либерти нет, создаем его
        IF _liberty_grade_product_id IS NULL THEN
            INSERT INTO products (
                name, 
                article, 
                category_id, 
                product_type, 
                grade, 
                is_active, 
                notes
            ) VALUES (
                _target_product_name, 
                'Либер-' || _target_product_name, 
                (SELECT category_id FROM products WHERE id = _target_product_id), 
                (SELECT product_type FROM products WHERE id = _target_product_id), 
                'liber', 
                TRUE, 
                'Автоматически создан для сорта Либерти по операции резки #' || NEW.operation_id
            ) RETURNING id INTO _liberty_grade_product_id;

            -- Создаем запись остатков для нового товара
            INSERT INTO stock (product_id, current_stock, reserved_stock)
            VALUES (_liberty_grade_product_id, 0, 0);
        END IF;

        UPDATE stock 
        SET 
            current_stock = current_stock + _liberty_grade_diff,
            updated_at = NOW()
        WHERE product_id = _liberty_grade_product_id;

        -- Логируем движение товара сорта Либерти
        INSERT INTO stock_movements (
            product_id, 
            movement_type, 
            quantity, 
            reference_id, 
            reference_type, 
            comment, 
            user_id
        ) VALUES (
            _liberty_grade_product_id,
            (CASE WHEN _liberty_grade_diff > 0 THEN 'cutting_in' ELSE 'outgoing' END)::movement_type,
            ABS(_liberty_grade_diff),
            NEW.operation_id,
            'cutting_progress',
            'Корректировка сорта Либерти по операции резки #' || NEW.operation_id || ' (прогресс)',
            _user_id
        );
    END IF;

    RETURN NEW;
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
