#!/bin/bash

# Скрипт для применения миграции диапазона дат для операций резки
# Применяется на staging Railway базу данных

set -e

echo "🚀 Применение миграции диапазона дат для операций резки"
echo "📅 Дата: $(date)"
echo ""

# Проверяем наличие переменной окружения
if [ -z "$DATABASE_PUBLIC_URL" ]; then
    echo "❌ Ошибка: Переменная DATABASE_PUBLIC_URL не установлена"
    echo "Установите её командой:"
    echo "export DATABASE_PUBLIC_URL='postgresql://postgres:pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL@tramway.proxy.rlwy.net:50363/railway'"
    exit 1
fi

echo "🔗 Подключение к базе данных: $DATABASE_PUBLIC_URL"
echo ""

# Проверяем подключение к базе данных
echo "🔍 Проверка подключения к базе данных..."
psql "$DATABASE_PUBLIC_URL" -c "SELECT version();" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Подключение к базе данных успешно"
else
    echo "❌ Ошибка подключения к базе данных"
    exit 1
fi

echo ""

# Создаем резервную копию перед миграцией
echo "💾 Создание резервной копии таблицы cutting_operations..."
BACKUP_FILE="cutting_operations_backup_$(date +%Y%m%d_%H%M%S).sql"
psql "$DATABASE_PUBLIC_URL" -c "\copy cutting_operations TO '$BACKUP_FILE' WITH CSV HEADER"
echo "✅ Резервная копия сохранена в файл: $BACKUP_FILE"

echo ""

# Проверяем текущее состояние таблицы
echo "📊 Текущее состояние таблицы cutting_operations:"
psql "$DATABASE_PUBLIC_URL" -c "
SELECT 
  COUNT(*) as total_operations,
  COUNT(planned_date) as with_planned_date
FROM cutting_operations;
"

echo ""

# Применяем миграцию
echo "🔄 Применение миграции..."
psql "$DATABASE_PUBLIC_URL" -f backend/migrations/add_cutting_operations_date_range.sql

if [ $? -eq 0 ]; then
    echo "✅ Миграция успешно применена"
else
    echo "❌ Ошибка при применении миграции"
    exit 1
fi

echo ""

# Проверяем результат миграции
echo "📊 Результат миграции:"
psql "$DATABASE_PUBLIC_URL" -c "
SELECT 
  COUNT(*) as total_operations,
  COUNT(planned_date) as with_planned_date,
  COUNT(planned_start_date) as with_start_date,
  COUNT(planned_end_date) as with_end_date,
  COUNT(CASE WHEN planned_start_date IS NOT NULL AND planned_end_date IS NOT NULL THEN 1 END) as with_full_range
FROM cutting_operations;
"

echo ""

# Проверяем индексы
echo "🔍 Проверка созданных индексов:"
psql "$DATABASE_PUBLIC_URL" -c "
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'cutting_operations' 
  AND indexname LIKE '%planned%';
"

echo ""

# Проверяем представление
echo "📋 Проверка созданного представления:"
psql "$DATABASE_PUBLIC_URL" -c "
SELECT COUNT(*) as operations_with_duration 
FROM cutting_operations_with_duration 
WHERE duration_days IS NOT NULL;
"

echo ""
echo "🎉 Миграция успешно завершена!"
echo ""
echo "📝 Что было сделано:"
echo "  ✅ Добавлены поля planned_start_date и planned_end_date"
echo "  ✅ Созданы индексы для оптимизации запросов"
echo "  ✅ Добавлена валидация диапазона дат"
echo "  ✅ Создана функция расчета продолжительности"
echo "  ✅ Создано представление для удобного отображения"
echo "  ✅ Добавлен триггер для обратной совместимости"
echo "  ✅ Мигрированы существующие данные"
echo ""
echo "🚀 Теперь можно тестировать новую функциональность диапазона дат!"
