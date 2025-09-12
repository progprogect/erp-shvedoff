#!/bin/bash

# Тестовый скрипт для проверки функционала множественных заказов в отгрузках
API_BASE_URL="http://localhost:5001/api"

echo "🧪 Начинаем тестирование функционала множественных заказов в отгрузках..."
echo ""

# 1. Авторизация
echo "1️⃣ Авторизация..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "director", "password": "123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Ошибка авторизации"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Авторизация успешна"
echo ""

# 2. Получаем готовые заказы
echo "2️⃣ Получаем готовые заказы..."
READY_ORDERS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/shipments/ready-orders" \
  -H "Authorization: Bearer $TOKEN")

echo "Ответ API:"
echo "$READY_ORDERS_RESPONSE" | jq '.' 2>/dev/null || echo "$READY_ORDERS_RESPONSE"
echo ""

# 3. Получаем список всех отгрузок
echo "3️⃣ Получаем список всех отгрузок..."
SHIPMENTS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/shipments" \
  -H "Authorization: Bearer $TOKEN")

echo "Ответ API:"
echo "$SHIPMENTS_RESPONSE" | jq '.' 2>/dev/null || echo "$SHIPMENTS_RESPONSE"
echo ""

# 4. Получаем статистику отгрузок
echo "4️⃣ Получаем статистику отгрузок..."
STATS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/shipments/statistics" \
  -H "Authorization: Bearer $TOKEN")

echo "Ответ API:"
echo "$STATS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

echo "🎉 Тестирование завершено!"
