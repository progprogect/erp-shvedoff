#!/bin/bash

echo "🚀 Выполняю миграцию на Railway через DATABASE_PUBLIC_URL..."

# Получаем DATABASE_PUBLIC_URL из Railway
echo "🔗 Получаю DATABASE_PUBLIC_URL..."
DATABASE_URL=$(railway run -- bash -c 'echo $DATABASE_PUBLIC_URL')

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Не удалось получить DATABASE_PUBLIC_URL"
    exit 1
fi

echo "✅ DATABASE_PUBLIC_URL получен: $DATABASE_URL"

# Выполняем основную миграцию
echo "📋 Выполняю основную миграцию..."
psql "$DATABASE_URL" -f backend/migrations/railway_migration_main.sql

if [ $? -eq 0 ]; then
    echo "✅ Миграция выполнена успешно!"
    
    echo "🔍 Проверяю результат..."
    
    # Проверяем новые таблицы
    echo "📊 Проверяю новые таблицы..."
    psql "$DATABASE_URL" -c "SELECT * FROM carpet_edge_types;"
    psql "$DATABASE_URL" -c "SELECT * FROM bottom_types;"
    
    # Проверяем новые поля в products
    echo "🔍 Проверяю новые поля в products..."
    psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('carpet_edge_type', 'carpet_edge_sides', 'carpet_edge_strength', 'bottom_type_id', 'puzzle_type_id', 'puzzle_sides');"
    
    echo "🎉 Проверка завершена!"
else
    echo "❌ Ошибка при выполнении миграции"
    exit 1
fi

