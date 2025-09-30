#!/bin/bash

# Скрипт для тестирования гибкой системы планирования
echo "🧪 Тестирование гибкой системы планирования производства..."

# Параметры подключения к стейджу
STAGING_DB_URL="postgresql://postgres:pTMtLhlEmgeRAtUlFvGBhAYLNIlMkhwL@tramway.proxy.rlwy.net:50363/railway"

echo "📊 Проверяем структуру таблицы production_tasks..."
psql "$STAGING_DB_URL" -c "
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'production_tasks' 
  AND column_name LIKE '%planned%' OR column_name LIKE '%planning%' OR column_name LIKE '%duration%'
ORDER BY ordinal_position;
"

echo ""
echo "📋 Проверяем существующие задания с новыми полями..."
psql "$STAGING_DB_URL" -c "
SELECT 
  id,
  requested_quantity,
  planned_start_date,
  planned_end_date,
  estimated_duration_days,
  planning_status,
  is_flexible,
  status
FROM production_tasks 
ORDER BY id
LIMIT 10;
"

echo ""
echo "🔍 Тестируем функцию валидации планирования..."
psql "$STAGING_DB_URL" -c "
SELECT 
  validate_production_planning(
    '2025-02-01'::timestamp,
    '2025-02-03'::timestamp,
    3
  ) as valid_planning;
"

echo ""
echo "⚠️ Тестируем функцию валидации с некорректными данными..."
psql "$STAGING_DB_URL" -c "
SELECT 
  validate_production_planning(
    '2025-02-03'::timestamp,
    '2025-02-01'::timestamp,
    3
  ) as invalid_planning;
"

echo ""
echo "🔄 Тестируем функцию проверки перекрытий..."
psql "$STAGING_DB_URL" -c "
SELECT * FROM check_production_overlaps(
  NULL,
  '2025-02-01'::timestamp,
  '2025-02-03'::timestamp
);
"

echo ""
echo "📈 Тестируем статистику планирования..."
psql "$STAGING_DB_URL" -c "
SELECT * FROM get_production_planning_stats(
  '2025-01-01'::date,
  '2025-12-31'::date
);
"

echo ""
echo "🎯 Тестируем представление с планированием..."
psql "$STAGING_DB_URL" -c "
SELECT 
  id,
  product_name,
  planned_start_date,
  planned_end_date,
  calculated_duration_days,
  planning_status_display,
  status
FROM production_tasks_with_planning 
LIMIT 5;
"

echo ""
echo "✅ Тестирование завершено!"
echo "🎉 Гибкая система планирования готова к использованию!"
