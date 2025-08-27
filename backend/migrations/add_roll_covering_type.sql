-- ЭТАП 1: Добавляем значение к enum (должно быть в отдельной транзакции)
ALTER TYPE product_type ADD VALUE 'roll_covering';

-- ЭТАП 2: Создаем таблицу состава рулонных покрытий
BEGIN;

-- Создаем таблицу для состава рулонных покрытий
CREATE TABLE roll_covering_composition (
  id SERIAL PRIMARY KEY,
  roll_covering_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  carpet_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавляем комментарии для документации
COMMENT ON TABLE roll_covering_composition IS 'Состав рулонных покрытий - список ковров с количеством и порядком';
COMMENT ON COLUMN roll_covering_composition.roll_covering_id IS 'ID рулонного покрытия';
COMMENT ON COLUMN roll_covering_composition.carpet_id IS 'ID ковра в составе';
COMMENT ON COLUMN roll_covering_composition.quantity IS 'Количество данного ковра в составе';
COMMENT ON COLUMN roll_covering_composition.sort_order IS 'Порядок ковра в составе (для сортировки)';

-- Добавляем индексы для производительности
CREATE INDEX idx_roll_covering_composition_roll_covering_id ON roll_covering_composition (roll_covering_id);
CREATE INDEX idx_roll_covering_composition_carpet_id ON roll_covering_composition (carpet_id);
CREATE INDEX idx_roll_covering_composition_sort_order ON roll_covering_composition (roll_covering_id, sort_order);

-- Добавляем проверочные ограничения
ALTER TABLE roll_covering_composition ADD CONSTRAINT check_quantity_positive 
  CHECK (quantity > 0);

ALTER TABLE roll_covering_composition ADD CONSTRAINT check_sort_order_positive 
  CHECK (sort_order >= 0);

-- Добавляем уникальное ограничение на порядок в рамках одного покрытия
ALTER TABLE roll_covering_composition ADD CONSTRAINT unique_roll_covering_sort_order 
  UNIQUE (roll_covering_id, sort_order);

-- Добавляем ограничение чтобы ковер не мог ссылаться сам на себя
ALTER TABLE roll_covering_composition ADD CONSTRAINT check_no_self_reference 
  CHECK (roll_covering_id != carpet_id);

COMMIT;
