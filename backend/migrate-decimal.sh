#!/bin/bash

# Скрипт для выполнения миграции decimal quantity через Railway
echo "🚀 Выполнение миграции decimal quantity на Railway stage БД..."

# Выполняем миграцию через Railway run
railway run bash -c "echo 'BEGIN;' | psql \$DATABASE_URL && \\
echo \"DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roll_covering_composition') THEN
        RAISE EXCEPTION 'Таблица roll_covering_composition не существует';
    END IF;
END \$\$;\" | psql \$DATABASE_URL && \\
echo 'ALTER TABLE roll_covering_composition ALTER COLUMN quantity TYPE DECIMAL(10,2);' | psql \$DATABASE_URL && \\
echo 'ALTER TABLE roll_covering_composition DROP CONSTRAINT IF EXISTS check_quantity_positive;' | psql \$DATABASE_URL && \\
echo 'ALTER TABLE roll_covering_composition ADD CONSTRAINT check_quantity_positive CHECK (quantity >= 0.01);' | psql \$DATABASE_URL && \\
echo \"COMMENT ON COLUMN roll_covering_composition.quantity IS 'Количество данного ковра в составе (поддерживает дробные значения до 2 знаков после запятой)';\" | psql \$DATABASE_URL && \\
echo 'COMMIT;' | psql \$DATABASE_URL"

echo "✅ Миграция выполнена!"
