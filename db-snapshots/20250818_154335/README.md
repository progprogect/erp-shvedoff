# Снепшот БД ERP Shvedoff
Дата: Mon Aug 18 15:43:35 +03 2025
Цель: Защита данных перед миграцией edges_v2

## Содержимое:
- schema.sql - схема БД
- *_data.sql - данные по таблицам

## Восстановление:
```bash
# Восстановление схемы
psql -h localhost -U mikitavalkunovich -d erp_shvedoff < schema.sql

# Восстановление данных
psql -h localhost -U mikitavalkunovich -d erp_shvedoff < products_data.sql
psql -h localhost -U mikitavalkunovich -d erp_shvedoff < product_surfaces_data.sql
# ... и т.д.
```

## Статус миграции:
- [ ] Создан снепшот
- [ ] Выполнена миграция
- [ ] Протестированы изменения
- [ ] Снепшот можно удалить
