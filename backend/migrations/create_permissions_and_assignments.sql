-- Миграция: Добавление системы разрешений и полей для назначения задач
-- Дата: 2025-01-15

-- Создание таблицы разрешений
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Создание таблицы разрешений ролей
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role user_role NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

-- Создание таблицы индивидуальных разрешений пользователей
CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, permission_id)
);

-- Добавление полей для назначения в production_tasks
ALTER TABLE production_tasks 
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS started_by INTEGER REFERENCES users(id);

-- Добавление поля для назначения в cutting_operations
ALTER TABLE cutting_operations 
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id);

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_assigned_to ON production_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cutting_operations_assigned_to ON cutting_operations(assigned_to);

-- Вставка базовых разрешений
INSERT INTO permissions (name, resource, action, description) VALUES
-- Каталог
('Просмотр каталога', 'catalog', 'view', 'Просмотр списка товаров и категорий'),
('Создание товаров', 'catalog', 'create', 'Создание новых товаров и категорий'),
('Редактирование товаров', 'catalog', 'edit', 'Изменение товаров и категорий'),
('Удаление товаров', 'catalog', 'delete', 'Удаление товаров и категорий'),

-- Остатки
('Просмотр остатков', 'stock', 'view', 'Просмотр остатков на складе'),
('Корректировка остатков', 'stock', 'edit', 'Изменение остатков товаров'),
('Управление остатками', 'stock', 'manage', 'Полное управление остатками'),

-- Заказы
('Просмотр заказов', 'orders', 'view', 'Просмотр списка заказов'),
('Создание заказов', 'orders', 'create', 'Создание новых заказов'),
('Редактирование заказов', 'orders', 'edit', 'Изменение заказов'),
('Удаление заказов', 'orders', 'delete', 'Удаление заказов'),

-- Производство
('Просмотр производства', 'production', 'view', 'Просмотр производственных заданий'),
('Создание заданий', 'production', 'create', 'Создание производственных заданий'),
('Управление производством', 'production', 'manage', 'Полное управление производством'),

-- Операции резки
('Просмотр операций резки', 'cutting', 'view', 'Просмотр операций резки'),
('Создание операций резки', 'cutting', 'create', 'Создание заявок на резку'),
('Выполнение операций резки', 'cutting', 'execute', 'Выполнение операций резки'),

-- Отгрузки
('Просмотр отгрузок', 'shipments', 'view', 'Просмотр отгрузок'),
('Создание отгрузок', 'shipments', 'create', 'Создание отгрузок'),
('Управление отгрузками', 'shipments', 'manage', 'Полное управление отгрузками'),

-- Пользователи
('Просмотр пользователей', 'users', 'view', 'Просмотр списка пользователей'),
('Управление пользователями', 'users', 'manage', 'Создание и редактирование пользователей'),

-- Разрешения
('Управление разрешениями', 'permissions', 'manage', 'Управление системой разрешений'),

-- Аудит
('Просмотр аудита', 'audit', 'view', 'Просмотр истории изменений')
ON CONFLICT (name) DO NOTHING;

-- Установка разрешений для директора (все разрешения)
INSERT INTO role_permissions (role, permission_id)
SELECT 'director', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Установка разрешений для менеджера
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE 
    (resource = 'catalog' AND action IN ('view', 'create', 'edit')) OR
    (resource = 'stock' AND action = 'view') OR
    (resource = 'orders' AND action IN ('view', 'create', 'edit', 'delete')) OR
    (resource = 'production' AND action = 'view') OR
    (resource = 'cutting' AND action IN ('view', 'create')) OR
    (resource = 'shipments' AND action IN ('view', 'create', 'manage'))
ON CONFLICT (role, permission_id) DO NOTHING;

-- Установка разрешений для производства
INSERT INTO role_permissions (role, permission_id)
SELECT 'production', id FROM permissions WHERE 
    (resource = 'catalog' AND action = 'view') OR
    (resource = 'stock' AND action = 'view') OR
    (resource = 'orders' AND action = 'view') OR
    (resource = 'production' AND action IN ('view', 'create', 'manage')) OR
    (resource = 'cutting' AND action IN ('view', 'execute')) OR
    (resource = 'shipments' AND action = 'view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Установка разрешений для склада
INSERT INTO role_permissions (role, permission_id)
SELECT 'warehouse', id FROM permissions WHERE 
    (resource = 'catalog' AND action = 'view') OR
    (resource = 'stock' AND action IN ('view', 'edit')) OR
    (resource = 'orders' AND action = 'view') OR
    (resource = 'shipments' AND action IN ('view', 'manage'))
ON CONFLICT (role, permission_id) DO NOTHING;

-- Комментарий о миграции
INSERT INTO audit_log (table_name, operation, new_values, user_id, created_at)
VALUES ('system', 'MIGRATION', '{"migration": "create_permissions_and_assignments", "description": "Добавлена система разрешений и поля назначения задач"}', 1, NOW()); 