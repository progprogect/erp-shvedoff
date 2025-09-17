# 🎯 АНАЛИЗ МИГРАЦИИ БД: STAGING ↔ PRODUCTION

## 📊 СВОДКА АНАЛИЗА

**Дата анализа:** $(date)  
**Проект:** ERP-Shvedoff  
**Environments:** Railway staging → production

---

## ✅ РЕЗУЛЬТАТЫ СРАВНЕНИЯ СХЕМ

### 🏗️ **СТРУКТУРА БД**
- ✅ **СХЕМЫ ИДЕНТИЧНЫ** - staging и production имеют одинаковую структуру
- ✅ **29 таблиц** в обеих БД
- ✅ **Типы данных** совпадают
- ✅ **Ограничения и индексы** совпадают
- ✅ **Внешние ключи** совпадают

---

## 🔍 РАЗЛИЧИЯ В СПРАВОЧНЫХ ДАННЫХ

### 📋 **КАТЕГОРИИ**
| Environment | Количество | Различия |
|------------|------------|----------|
| **Staging** | 4 категории | ID: 1, 2, 5, 6 |
| **Production** | 3 категории | ID: 2, 3, 4 |

**🚨 КРИТИЧЕСКИЕ РАЗЛИЧИЯ:**
- **Staging:** есть категория `id=1 "Лежаки верблюды"`
- **Staging:** есть категория `id=5 "Места отдыха животных"`  
- **Production:** есть категория `id=3 "Места отдыха животных"`
- **Production:** категория "Другое" имеет `id=4` вместо `id=6`

### 🛠️ **ТИПЫ НИЗА (BOTTOM_TYPES)**
| Environment | Количество | Различия |
|------------|------------|----------|
| **Staging** | 6 типов | Включает "Не выбрано" |
| **Production** | 5 типов | Отсутствует "Не выбрано" |

**🚨 КРИТИЧЕСКИЕ РАЗЛИЧИЯ:**
- **Staging:** есть `id=6, code="not_selected", name="Не выбрано"`
- **Production:** этого типа НЕТ

### 🔧 **ТИПЫ КРОМОК КОВРОВ**
| Environment | Количество | Различия |
|------------|------------|----------|
| **Staging** | 5 типов | Включает "Литой" |
| **Production** | 4 типов | Отсутствует "Литой" |

**🚨 КРИТИЧЕСКИЕ РАЗЛИЧИЯ:**
- **Staging:** есть `id=5, code="straight_cut", name="Литой"`
- **Production:** этого типа НЕТ
- **Разные коды:** staging использует "direct_cut", production использует "straight_cut"

### 👥 **ПОЛЬЗОВАТЕЛИ**
| Environment | Количество | Различия |
|------------|------------|----------|
| **Staging** | 2 пользователя | director, Sergey |
| **Production** | 3 пользователя | director, Sergey, tremolo |

**🚨 КРИТИЧЕСКИЕ РАЗЛИЧИЯ:**
- **Production:** есть дополнительный пользователь `tremolo (manager)`

### 📦 **ТОВАРЫ И ОСТАТКИ**
| Environment | Товары | Остатки | Типы товаров |
|------------|--------|---------|-------------|
| **Staging** | 158 | 39,720 | carpet(138), other(7), pur(3), roll_covering(10) |
| **Production** | 125 | 46,337 | carpet(116), other(2), pur(7) |

**🚨 КРИТИЧЕСКИЕ РАЗЛИЧИЯ:**
- **Staging:** +33 товара больше
- **Production:** НЕТ товаров типа `roll_covering`
- **Production:** +6,617 больше остатков

---

## ⚠️ РИСКИ И ПРОБЛЕМЫ

### 🔴 **ВЫСОКИЕ РИСКИ**
1. **Несовместимость ID категорий** - может сломать связи товар↔категория
2. **Отсутствие справочников** в production (bottom_types, carpet_edge_types)
3. **Отсутствие товаров roll_covering** в production
4. **Разные коды справочников** - может сломать логику приложения

### 🟡 **СРЕДНИЕ РИСКИ**
1. **Потеря пользователя tremolo** при переносе staging → production
2. **Разные объемы данных** - 33 товара разности
3. **Разные остатки** - потенциальная потеря 6,617 единиц

---

## 🔧 ПЛАН МИГРАЦИИ PRODUCTION → STAGING

### **ЭТАП 1: РЕЗЕРВНОЕ КОПИРОВАНИЕ** 🛡️
```bash
# 1. Backup production БД
pg_dump -h yamanote.proxy.rlwy.net -p 41401 -U postgres -d railway \
  --verbose --format=custom --compress=9 \
  > production_backup_$(date +%Y%m%d_%H%M%S).backup

# 2. Backup справочных данных production
psql -h yamanote.proxy.rlwy.net -p 41401 -U postgres -d railway \
  -c "COPY categories TO '/tmp/prod_categories.csv' WITH CSV HEADER;" \
  -c "COPY bottom_types TO '/tmp/prod_bottom_types.csv' WITH CSV HEADER;" \
  -c "COPY carpet_edge_types TO '/tmp/prod_carpet_edge_types.csv' WITH CSV HEADER;" \
  -c "COPY users TO '/tmp/prod_users.csv' WITH CSV HEADER;"
```

### **ЭТАП 2: СИНХРОНИЗАЦИЯ СПРАВОЧНИКОВ** 📚
```sql
-- 2.1 Обновить категории в production под staging
DELETE FROM categories WHERE id NOT IN (1, 2, 5, 6);
INSERT INTO categories (id, name, parent_id, sort_order, created_at, updated_at) VALUES 
  (1, 'Лежаки верблюды', NULL, 0, now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

UPDATE categories SET id = 5 WHERE id = 3 AND name = 'Места отдыха животных';
UPDATE categories SET id = 6 WHERE id = 4 AND name = 'Другое';

-- 2.2 Добавить недостающие типы низа
INSERT INTO bottom_types (id, code, name, description, is_system, created_at) VALUES 
  (6, 'not_selected', 'Не выбрано', 'Низ ковра не выбран', true, now())
ON CONFLICT (id) DO NOTHING;

-- 2.3 Добавить недостающие типы кромок
INSERT INTO carpet_edge_types (id, name, code, description, is_system, created_at) VALUES 
  (5, 'Литой', 'straight_cut', 'Литой край ковра (по умолчанию)', false, now())
ON CONFLICT (id) DO NOTHING;

-- 2.4 Исправить коды кромок (если нужно)
UPDATE carpet_edge_types SET code = 'direct_cut' WHERE code = 'straight_cut' AND name = 'Прямой рез';
```

### **ЭТАП 3: СИНХРОНИЗАЦИЯ ДАННЫХ** 📊
```sql
-- 3.1 Сохранить критически важные данные production
CREATE TEMP TABLE prod_users_backup AS SELECT * FROM users WHERE username = 'tremolo';
CREATE TEMP TABLE prod_critical_stock AS 
  SELECT p.id, p.article, s.current_stock 
  FROM products p 
  JOIN stock s ON p.id = s.product_id 
  WHERE s.current_stock > 0;

-- 3.2 Обновить товары и остатки (только если требуется полная синхронизация)
-- ВНИМАНИЕ: это удалит все товары production!
-- TRUNCATE products CASCADE;
-- TRUNCATE stock CASCADE;
-- Вставить данные из staging...
```

### **ЭТАП 4: ВОССТАНОВЛЕНИЕ КРИТИЧЕСКИХ ДАННЫХ** 🔄
```sql
-- 4.1 Восстановить пользователя tremolo
INSERT INTO users (username, role, created_at) 
SELECT username, role, created_at FROM prod_users_backup
ON CONFLICT (username) DO NOTHING;

-- 4.2 Проверить и откорректировать остатки
-- Вручную проанализировать critical_stock и принять решения
```

### **ЭТАП 5: ВАЛИДАЦИЯ** ✅
```sql
-- 5.1 Проверка справочников
SELECT 'categories' as table_name, count(*) FROM categories;
SELECT 'bottom_types' as table_name, count(*) FROM bottom_types;
SELECT 'carpet_edge_types' as table_name, count(*) FROM carpet_edge_types;

-- 5.2 Проверка данных
SELECT 'products' as table_name, count(*) FROM products;
SELECT 'users' as table_name, count(*) FROM users;
SELECT 'stock_total' as metric, sum(current_stock) FROM stock;

-- 5.3 Проверка связей
SELECT p.product_type, count(*) 
FROM products p 
GROUP BY p.product_type;
```

---

## 📋 РЕКОМЕНДУЕМАЯ СТРАТЕГИЯ

### **🎯 ВАРИАНТ A: МИНИМАЛЬНАЯ МИГРАЦИЯ (РЕКОМЕНДУЕТСЯ)**
✅ **Что делать:**
1. Обновить **только справочники** в production под staging
2. Сохранить **все товары и остатки** production
3. Добавить недостающие справочники
4. Сохранить пользователя `tremolo`

✅ **Преимущества:**
- Минимальный риск потери данных
- Быстрая миграция
- Сохранение production данных

### **🎯 ВАРИАНТ B: ПОЛНАЯ СИНХРОНИЗАЦИЯ**
⚠️ **Что делать:**
1. Полная замена данных production на staging
2. Ручное восстановление критических данных

⚠️ **Риски:**
- Потеря production товаров и остатков
- Потеря пользователя tremolo
- Длительный downtime

---

## 🚨 КРИТИЧЕСКИЕ ПРОВЕРКИ ПЕРЕД МИГРАЦИЕЙ

### ✅ **ОБЯЗАТЕЛЬНЫЕ ШАГИ:**
1. **Полный backup production** с проверкой восстановления
2. **Уведомление пользователей** о maintenance window  
3. **Проверка staging** на работоспособность
4. **План rollback** в случае проблем
5. **Тестирование** приложения после миграции

### 🔍 **ВОПРОСЫ ДЛЯ УТОЧНЕНИЯ:**
1. Какие production товары/остатки критически важны?
2. Нужно ли сохранить пользователя `tremolo`?
3. Какой вариант миграции предпочтительнее?
4. Какое время maintenance window доступно?

---

## 📞 СЛЕДУЮЩИЕ ШАГИ

1. **Согласовать стратегию** миграции с пользователем
2. **Создать детальные скрипты** миграции  
3. **Протестировать** на копии production
4. **Выполнить миграцию** по утвержденному плану
5. **Проверить работоспособность** системы

---

*Анализ выполнен автоматически*  
*Инструкция по доступу: `RAILWAY_DB_ACCESS_GUIDE.md`*






