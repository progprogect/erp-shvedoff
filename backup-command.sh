#!/bin/bash

echo "🔒 Создаю бэкап через railway run..."
echo "📁 Файл: erp-backup-$(date +%Y%m%d-%H%M%S).dump"
echo ""

# Создаем бэкап через railway run
railway run -- pg_dump --no-owner --format=custom --verbose --file="erp-backup-$(date +%Y%m%d-%H%M%S).dump"

echo ""
echo "✅ Бэкап создан!"
ls -lh erp-backup-*.dump


