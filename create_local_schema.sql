-- Создание схемы локальной базы данных ERP Shvedoff
-- Использование: psql -d erp_shvedoff_local -f create_local_schema.sql

-- Создание enum типов
CREATE TYPE user_role AS ENUM ('manager', 'director', 'production', 'warehouse');
CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'in_production', 'ready', 'completed', 'cancelled');
CREATE TYPE order_source AS ENUM ('database', 'website', 'avito', 'referral', 'cold_call', 'other');
CREATE TYPE priority_level AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE movement_type AS ENUM ('incoming', 'outgoing', 'cutting_out', 'cutting_in', 'reservation', 'release_reservation', 'adjustment');
CREATE TYPE production_status AS ENUM ('queued', 'in_progress', 'completed', 'cancelled');
CREATE TYPE cutting_status AS ENUM ('planned', 'approved', 'in_progress', 'paused', 'completed', 'cancelled');
CREATE TYPE shipment_status AS ENUM ('pending', 'completed', 'cancelled', 'paused');
CREATE TYPE defect_status AS ENUM ('identified', 'under_review', 'for_repair', 'for_rework', 'written_off');
CREATE TYPE audit_operation AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- Создание таблиц
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    telegram_id VARCHAR(50) UNIQUE,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role user_role NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    permission_id INTEGER NOT NULL REFERENCES permissions(id),
    granted BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    path TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_surfaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_logos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE puzzle_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    category_id INTEGER REFERENCES categories(id),
    surface_id INTEGER REFERENCES product_surfaces(id),
    logo_id INTEGER REFERENCES product_logos(id),
    material_id INTEGER REFERENCES product_materials(id),
    puzzle_type_id INTEGER REFERENCES puzzle_types(id),
    puzzle_sides INTEGER DEFAULT 1,
    length_mm INTEGER,
    width_mm INTEGER,
    thickness_mm INTEGER,
    weight_kg DECIMAL(10,3),
    grade VARCHAR(50),
    price DECIMAL(10,2),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    current_stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    max_stock INTEGER,
    location VARCHAR(100),
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    status order_status NOT NULL DEFAULT 'new',
    source order_source DEFAULT 'database',
    priority priority_level DEFAULT 'normal',
    total_amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    notes TEXT
);

CREATE TABLE production_tasks (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    requested_quantity INTEGER NOT NULL,
    status production_status NOT NULL DEFAULT 'queued',
    priority priority_level DEFAULT 'normal',
    estimated_duration_hours INTEGER,
    assigned_user_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cutting_operations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    status cutting_status NOT NULL DEFAULT 'planned',
    assigned_user_id INTEGER REFERENCES users(id),
    production_task_id INTEGER REFERENCES production_tasks(id),
    order_id INTEGER REFERENCES orders(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    shipment_number VARCHAR(50) NOT NULL UNIQUE,
    order_id INTEGER REFERENCES orders(id),
    status shipment_status NOT NULL DEFAULT 'pending',
    shipping_date DATE,
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER,
    operation audit_operation NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Создание индексов
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_stock_product_id ON stock(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_name ON orders(customer_name);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_production_tasks_status ON production_tasks(status);
CREATE INDEX idx_cutting_operations_status ON cutting_operations(cut_status);
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);

-- Создание последовательностей
CREATE SEQUENCE IF NOT EXISTS users_id_seq;
CREATE SEQUENCE IF NOT EXISTS categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS products_id_seq;
CREATE SEQUENCE IF NOT EXISTS orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS production_tasks_id_seq;
CREATE SEQUENCE IF NOT EXISTS cutting_operations_id_seq;
CREATE SEQUENCE IF NOT EXISTS shipments_id_seq;

-- Установка значений последовательностей
SELECT setval('users_id_seq', 1);
SELECT setval('categories_id_seq', 1);
SELECT setval('products_id_seq', 1);
SELECT setval('orders_id_seq', 1);
SELECT setval('production_tasks_id_seq', 1);
SELECT setval('cutting_operations_id_seq', 1);
SELECT setval('shipments_id_seq', 1);

-- Сообщение об успешном создании
SELECT 'Схема базы данных создана успешно!' as status;
