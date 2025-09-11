-- Production Database Backup
-- Created: 2025-09-11T15:17:40.124Z
-- Database: railway

-- Schema for cutting_operations table
CREATE TABLE cutting_operations (
  id integer NOT NULL DEFAULT nextval('cutting_operations_id_seq'::regclass),
  source_product_id integer NOT NULL,
  target_product_id integer NOT NULL,
  source_quantity integer NOT NULL,
  target_quantity integer NOT NULL,
  waste_quantity integer DEFAULT 0,
  status USER-DEFINED DEFAULT 'in_progress'::cutting_status,
  operator_id integer,
  assigned_to integer,
  planned_date timestamp without time zone,
  completed_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now()
);

