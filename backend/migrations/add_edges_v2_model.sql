-- Миграция: Расширение модели товара с поддержкой краёв и бортов (edges_v2)
-- Дата: 2025-08-18
-- Цель: Добавление новых полей для размеров, нижней поверхности и краёв товара
-- Фича-флаг: edges_v2

BEGIN;

-- ===== 1. ДОБАВЛЕНИЕ НОВЫХ ПОЛЕЙ В ТАБЛИЦУ PRODUCTS =====

-- Добавляем поле height_mm (заменяет thickness)
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_mm INTEGER;

-- Добавляем поле для типа нижней поверхности
ALTER TABLE products ADD COLUMN IF NOT EXISTS bottom_type_id INTEGER;

-- ===== 2. СОЗДАНИЕ СПРАВОЧНИКА ТИПОВ НИЖНЕЙ ПОВЕРХНОСТИ =====

-- Создаем таблицу типов нижней поверхности
CREATE TABLE IF NOT EXISTS bottom_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE, -- 'ship_0', 'ship_2', 'ship_5', 'ship_7', 'ship_11'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    preview_svg TEXT, -- SVG иконка для UI (опционально)
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Добавляем комментарий к таблице
COMMENT ON TABLE bottom_types IS 'Справочник типов нижней поверхности товаров (миллиметры шипов)';

-- Заполняем предустановленными типами
INSERT INTO bottom_types (code, name, description, is_system, created_at) VALUES
('ship_0', 'Шип 0мм', 'Без шипов (гладкая нижняя поверхность)', true, NOW()),
('ship_2', 'Шип 2мм', 'Шипы высотой 2 миллиметра', true, NOW()),
('ship_5', 'Шип 5мм', 'Шипы высотой 5 миллиметров', true, NOW()),
('ship_7', 'Шип 7мм', 'Шипы высотой 7 миллиметров', true, NOW()),
('ship_11', 'Шип 11мм', 'Шипы высотой 11 миллиметров', true, NOW())
ON CONFLICT (code) DO NOTHING;

-- ===== 3. СОЗДАНИЕ ТИПОВ ДЛЯ КРАЁВ =====

-- Создаем ENUM для типов краёв
CREATE TYPE IF NOT EXISTS edge_type AS ENUM ('puzzle', 'straight', 'plain');

-- Создаем ENUM для сторон краёв
CREATE TYPE IF NOT EXISTS edge_side AS ENUM ('top', 'bottom', 'left', 'right');

-- ===== 4. СОЗДАНИЕ ТАБЛИЦЫ КРАЁВ ТОВАРА =====

-- Создаем таблицу краёв товара
CREATE TABLE IF NOT EXISTS product_edges (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    side edge_side NOT NULL,
    edge_type edge_type NOT NULL,
    puzzle_type_id INTEGER REFERENCES puzzle_types(id), -- только если edge_type = 'puzzle'
    reinforced BOOLEAN DEFAULT false, -- усиленный / не усиленный
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Уникальность: один край на сторону товара
    UNIQUE(product_id, side)
);

-- Добавляем комментарии к таблице
COMMENT ON TABLE product_edges IS 'Края товара по каждой стороне с типом и опциями';
COMMENT ON COLUMN product_edges.side IS 'Сторона товара: top, bottom, left, right';
COMMENT ON COLUMN product_edges.edge_type IS 'Тип края: puzzle (паззл), straight (прямой), plain (обычный)';
COMMENT ON COLUMN product_edges.puzzle_type_id IS 'ID типа паззла (только для edge_type = puzzle)';
COMMENT ON COLUMN product_edges.reinforced IS 'Усиленный край: true/false';

-- ===== 5. ДОБАВЛЕНИЕ FK СВЯЗИ ДЛЯ BOTTOM_TYPE =====

-- Добавляем внешний ключ для bottom_type_id
ALTER TABLE products 
ADD CONSTRAINT fk_products_bottom_type 
FOREIGN KEY (bottom_type_id) REFERENCES bottom_types(id);

-- ===== 6. ИНДЕКСЫ ДЛЯ БЫСТРОЙ ФИЛЬТРАЦИИ =====

-- Основные индексы для фильтрации
CREATE INDEX IF NOT EXISTS idx_products_height_mm ON products(height_mm);
CREATE INDEX IF NOT EXISTS idx_products_bottom_type_id ON products(bottom_type_id);
CREATE INDEX IF NOT EXISTS idx_product_edges_product_id ON product_edges(product_id);
CREATE INDEX IF NOT EXISTS idx_product_edges_edge_type ON product_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_product_edges_side_type ON product_edges(side, edge_type);
CREATE INDEX IF NOT EXISTS idx_product_edges_reinforced ON product_edges(reinforced);

-- Составные индексы для сложных фильтров
CREATE INDEX IF NOT EXISTS idx_products_dimensions_filter ON products(length_mm, width_mm, height_mm);
CREATE INDEX IF NOT EXISTS idx_product_edges_puzzle_filter ON product_edges(product_id, edge_type, puzzle_type_id) WHERE edge_type = 'puzzle';

-- ===== 7. БЭКФИЛЛ СУЩЕСТВУЮЩИХ ДАННЫХ =====

-- Копируем данные из thickness в height_mm
UPDATE products 
SET height_mm = (dimensions->>'thickness')::INTEGER 
WHERE dimensions->>'thickness' IS NOT NULL 
  AND height_mm IS NULL;

-- Устанавливаем дефолтные значения для height_mm
UPDATE products 
SET height_mm = 0 
WHERE height_mm IS NULL;

-- Делаем height_mm NOT NULL после заполнения
ALTER TABLE products ALTER COLUMN height_mm SET NOT NULL;
ALTER TABLE products ALTER COLUMN height_mm SET DEFAULT 0;

-- Бэкфилл краёв для существующих товаров
-- По умолчанию все края = straight, не усиленные
INSERT INTO product_edges (product_id, side, edge_type, reinforced)
SELECT 
    p.id,
    unnest(ARRAY['top', 'bottom', 'left', 'right']::edge_side[]) as side,
    'straight'::edge_type as edge_type,
    false as reinforced
FROM products p
ON CONFLICT (product_id, side) DO NOTHING;

-- ===== 8. ПЕРЕНЕСЕНИЕ ПАЗЗЛОВ ИЗ PIZZLE_OPTIONS =====

-- Если у товара есть puzzleOptions и surface = "Паззл", переносим в края
UPDATE product_edges pe
SET 
    edge_type = 'puzzle',
    puzzle_type_id = (
        SELECT pt.id FROM puzzle_types pt 
        WHERE pt.code = p.puzzle_options->>'type'
    )
FROM products p
WHERE pe.product_id = p.id 
    AND p.surface_id = (SELECT id FROM product_surfaces WHERE name = 'Паззл')
    AND p.puzzle_options->>'enabled' = 'true'
    AND pe.side IN (
        CASE 
            WHEN p.puzzle_options->>'sides' = '1_side' THEN 'top'
            WHEN p.puzzle_options->>'sides' = '2_sides' THEN 'top'
            WHEN p.puzzle_options->>'sides' = '3_sides' THEN 'top'
            WHEN p.puzzle_options->>'sides' = '4_sides' THEN 'top'
            ELSE 'top'
        END
    );

-- ===== 9. ДОБАВЛЕНИЕ КОММЕНТАРИЕВ =====

-- Комментарии к новым полям products
COMMENT ON COLUMN products.height_mm IS 'Высота товара в миллиметрах (заменяет thickness)';
COMMENT ON COLUMN products.bottom_type_id IS 'ID типа нижней поверхности (шипы)';

-- ===== 10. ЛОГИРОВАНИЕ =====

-- Логируем выполнение миграции
INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values, user_id, created_at)
VALUES (
    'SYSTEM', 
    0, 
    'MIGRATION', 
    '{}', 
    '{"migration": "add_edges_v2_model", "status": "completed", "tables": ["bottom_types", "product_edges"], "fields": ["height_mm", "bottom_type_id"]}',
    1, 
    NOW()
);

COMMIT;

-- ===== 11. ВЕРИФИКАЦИЯ =====

-- Проверяем созданные таблицы
SELECT '=== ВЕРИФИКАЦИЯ МИГРАЦИИ ===' as status;

SELECT 'bottom_types' as table_name, COUNT(*) as rows_count FROM bottom_types
UNION ALL
SELECT 'product_edges', COUNT(*) FROM product_edges
UNION ALL
SELECT 'products with height_mm', COUNT(*) FROM products WHERE height_mm IS NOT NULL;

-- Проверяем индексы
SELECT '=== ПРОВЕРКА ИНДЕКСОВ ===' as status;
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename IN ('products', 'product_edges', 'bottom_types')
ORDER BY tablename, indexname;

SELECT '🎉 МИГРАЦИЯ add_edges_v2_model ВЫПОЛНЕНА УСПЕШНО!' as final_status;



