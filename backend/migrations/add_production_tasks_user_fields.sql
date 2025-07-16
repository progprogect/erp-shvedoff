-- Миграция для добавления полей пользователей в production_tasks
-- Безопасное добавление недостающих полей

-- Добавляем поля для отслеживания пользователей, если они не существуют
ALTER TABLE production_tasks 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS started_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS completed_by INTEGER REFERENCES users(id);

-- Добавляем поле sort_order если его нет
ALTER TABLE production_tasks 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Проверяем enum для статусов
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_task_status') THEN
        CREATE TYPE production_task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
    END IF;
END$$;

-- Обновляем поле статус если оно есть но неправильного типа
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'production_tasks' 
               AND column_name = 'status') THEN
        
        BEGIN
            ALTER TABLE production_tasks 
            ALTER COLUMN status TYPE production_task_status 
            USING COALESCE(status::text, 'pending')::production_task_status;
        EXCEPTION
            WHEN others THEN
                -- Если конвертация не удалась, устанавливаем по умолчанию
                ALTER TABLE production_tasks ALTER COLUMN status SET DEFAULT 'pending';
        END;
    ELSE
        ALTER TABLE production_tasks 
        ADD COLUMN status production_task_status DEFAULT 'pending';
    END IF;
END$$;

-- Устанавливаем правильный по умолчанию для статуса
ALTER TABLE production_tasks ALTER COLUMN status SET DEFAULT 'pending'; 