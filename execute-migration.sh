#!/bin/bash

echo "🚀 Выполняю миграцию на Railway..."

# Выполняем основную миграцию
echo "📋 Выполняю основную миграцию..."
railway run -- psql $DATABASE_URL -f backend/migrations/railway_migration_main.sql

echo "✅ Миграция завершена!"
echo "🔍 Проверяю результат..."

# Проверяем новые таблицы
echo "📊 Проверяю новые таблицы..."
railway run -- psql $DATABASE_URL -c "SELECT * FROM carpet_edge_types;"
railway run -- psql $DATABASE_URL -c "SELECT * FROM bottom_types;"

# Проверяем новые поля в products
echo "🔍 Проверяю новые поля в products..."
railway run -- psql $DATABASE_URL -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('carpet_edge_type', 'carpet_edge_sides', 'carpet_edge_strength', 'bottom_type_id', 'puzzle_type_id', 'puzzle_sides');"

echo "🎉 Проверка завершена!"

