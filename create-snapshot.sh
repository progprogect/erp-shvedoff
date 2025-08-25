#!/bin/bash

# Скрипт создания снепшота БД перед изменениями модели товара
# Дата: 2025-08-18
# Цель: Защита данных перед миграцией edges_v2

echo "🔒 СОЗДАНИЕ СНЕПШОТА БД ПЕРЕД ИЗМЕНЕНИЯМИ..."
echo "⏱️ Дата: $(date)"
echo ""

# Проверяем подключение к БД
if ! psql -h localhost -U mikitavalkunovich -d erp_shvedoff -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Ошибка подключения к БД. Проверьте настройки подключения."
    exit 1
fi

echo "✅ Подключение к БД установлено"

# Создаем директорию для снепшотов
SNAPSHOT_DIR="db-snapshots/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$SNAPSHOT_DIR"

echo "📁 Создана директория: $SNAPSHOT_DIR"

# Создаем снепшот схемы БД
echo "📋 Создаем снепшот схемы БД..."
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --schema-only > "$SNAPSHOT_DIR/schema.sql"

# Создаем снепшот данных по таблицам
echo "📊 Создаем снепшот данных..."

# Основные таблицы
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=products > "$SNAPSHOT_DIR/products_data.sql"
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=product_surfaces > "$SNAPSHOT_DIR/product_surfaces_data.sql"
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=puzzle_types > "$SNAPSHOT_DIR/puzzle_types_data.sql"
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=categories > "$SNAPSHOT_DIR/categories_data.sql"

# Справочники
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=product_logos > "$SNAPSHOT_DIR/product_logos_data.sql"
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=product_materials > "$SNAPSHOT_DIR/product_materials_data.sql"

# Связанные таблицы
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=stock > "$SNAPSHOT_DIR/stock_data.sql"
pg_dump -h localhost -U mikitavalkunovich -d erp_shvedoff --data-only --table=stock_movements > "$SNAPSHOT_DIR/stock_movements_data.sql"

# Создаем файл с информацией о снепшоте
cat > "$SNAPSHOT_DIR/README.md" << EOF
# Снепшот БД ERP Shvedoff
Дата: $(date)
Цель: Защита данных перед миграцией edges_v2

## Содержимое:
- schema.sql - схема БД
- *_data.sql - данные по таблицам

## Восстановление:
\`\`\`bash
# Восстановление схемы
psql -h localhost -U mikitavalkunovich -d erp_shvedoff < schema.sql

# Восстановление данных
psql -h localhost -U mikitavalkunovich -d erp_shvedoff < products_data.sql
psql -h localhost -U mikitavalkunovich -d erp_shvedoff < product_surfaces_data.sql
# ... и т.д.
\`\`\`

## Статус миграции:
- [ ] Создан снепшот
- [ ] Выполнена миграция
- [ ] Протестированы изменения
- [ ] Снепшот можно удалить
EOF

echo "📝 Создан README.md с инструкциями"

# Проверяем размеры файлов
echo ""
echo "📊 РАЗМЕРЫ СНЕПШОТА:"
ls -lh "$SNAPSHOT_DIR"/

echo ""
echo "✅ СНЕПШОТ СОЗДАН УСПЕШНО!"
echo "📁 Расположение: $SNAPSHOT_DIR"
echo "🔒 Данные защищены перед миграцией edges_v2"
echo ""
echo "🚀 Можно приступать к изменениям модели товара"




