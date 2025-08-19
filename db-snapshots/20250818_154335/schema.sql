--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit_operation; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.audit_operation AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
);


ALTER TYPE public.audit_operation OWNER TO mikitavalkunovich;

--
-- Name: border_type; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.border_type AS ENUM (
    'with_border',
    'without_border'
);


ALTER TYPE public.border_type OWNER TO mikitavalkunovich;

--
-- Name: cutting_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.cutting_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled',
    'approved',
    'paused'
);


ALTER TYPE public.cutting_status OWNER TO mikitavalkunovich;

--
-- Name: defect_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.defect_status AS ENUM (
    'identified',
    'under_review',
    'for_repair',
    'for_rework',
    'written_off'
);


ALTER TYPE public.defect_status OWNER TO mikitavalkunovich;

--
-- Name: movement_type; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.movement_type AS ENUM (
    'incoming',
    'outgoing',
    'cutting_out',
    'cutting_in',
    'reservation',
    'release_reservation',
    'adjustment'
);


ALTER TYPE public.movement_type OWNER TO mikitavalkunovich;

--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.notification_status AS ENUM (
    'pending',
    'sent',
    'failed'
);


ALTER TYPE public.notification_status OWNER TO mikitavalkunovich;

--
-- Name: order_source; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.order_source AS ENUM (
    'database',
    'website',
    'avito',
    'referral',
    'cold_call',
    'other'
);


ALTER TYPE public.order_source OWNER TO mikitavalkunovich;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.order_status AS ENUM (
    'new',
    'confirmed',
    'in_production',
    'ready',
    'shipped',
    'delivered',
    'cancelled',
    'completed'
);


ALTER TYPE public.order_status OWNER TO mikitavalkunovich;

--
-- Name: priority_level; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.priority_level AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE public.priority_level OWNER TO mikitavalkunovich;

--
-- Name: product_grade; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.product_grade AS ENUM (
    'usual',
    'grade_2'
);


ALTER TYPE public.product_grade OWNER TO mikitavalkunovich;

--
-- Name: production_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.production_status AS ENUM (
    'queued',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.production_status OWNER TO mikitavalkunovich;

--
-- Name: production_task_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.production_task_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'paused'
);


ALTER TYPE public.production_task_status OWNER TO mikitavalkunovich;

--
-- Name: production_task_status_new; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.production_task_status_new AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.production_task_status_new OWNER TO mikitavalkunovich;

--
-- Name: shipment_status; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.shipment_status AS ENUM (
    'planned',
    'loading',
    'shipped',
    'delivered',
    'cancelled',
    'pending',
    'paused',
    'completed'
);


ALTER TYPE public.shipment_status OWNER TO mikitavalkunovich;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: mikitavalkunovich
--

CREATE TYPE public.user_role AS ENUM (
    'manager',
    'director',
    'production',
    'warehouse'
);


ALTER TYPE public.user_role OWNER TO mikitavalkunovich;

--
-- Name: calculate_mat_area(jsonb); Type: FUNCTION; Schema: public; Owner: mikitavalkunovich
--

CREATE FUNCTION public.calculate_mat_area(dimensions_json jsonb) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    length_mm DECIMAL;
    width_mm DECIMAL;
    area_m2 DECIMAL(10,4);
BEGIN
    -- Извлекаем длину и ширину из JSON
    length_mm := (dimensions_json->>'length')::DECIMAL;
    width_mm := (dimensions_json->>'width')::DECIMAL;
    
    -- Если размеры указаны, рассчитываем площадь в м²
    IF length_mm IS NOT NULL AND width_mm IS NOT NULL AND length_mm > 0 AND width_mm > 0 THEN
        area_m2 := (length_mm * width_mm) / 1000000.0;
        RETURN ROUND(area_m2, 4);
    ELSE
        RETURN NULL;
    END IF;
END;
$$;


ALTER FUNCTION public.calculate_mat_area(dimensions_json jsonb) OWNER TO mikitavalkunovich;

--
-- Name: get_production_stats_by_day(date, date); Type: FUNCTION; Schema: public; Owner: mikitavalkunovich
--

CREATE FUNCTION public.get_production_stats_by_day(start_date date, end_date date) RETURNS TABLE(day_date date, total_tasks integer, pending_tasks integer, in_progress_tasks integer, completed_tasks integer, total_quantity integer, total_estimated_hours numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(pt.planned_date) as day_date,
        COUNT(*)::INTEGER as total_tasks,
        COUNT(CASE WHEN pt.status = 'pending' THEN 1 END)::INTEGER as pending_tasks,
        COUNT(CASE WHEN pt.status = 'in_progress' THEN 1 END)::INTEGER as in_progress_tasks,
        COUNT(CASE WHEN pt.status = 'completed' THEN 1 END)::INTEGER as completed_tasks,
        SUM(pt.requested_quantity)::INTEGER as total_quantity,
        ROUND(SUM(COALESCE(pt.estimated_duration, 0)) / 60.0, 2) as total_estimated_hours
    FROM production_tasks pt
    WHERE pt.planned_date IS NOT NULL 
      AND DATE(pt.planned_date) BETWEEN start_date AND end_date
    GROUP BY DATE(pt.planned_date)
    ORDER BY day_date;
END;
$$;


ALTER FUNCTION public.get_production_stats_by_day(start_date date, end_date date) OWNER TO mikitavalkunovich;

--
-- Name: get_production_tasks_by_date_range(date, date); Type: FUNCTION; Schema: public; Owner: mikitavalkunovich
--

CREATE FUNCTION public.get_production_tasks_by_date_range(start_date date, end_date date) RETURNS TABLE(task_id integer, planned_date timestamp without time zone, planned_start_time character varying, estimated_duration integer, product_name character varying, requested_quantity integer, status character varying, priority integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id as task_id,
        pt.planned_date,
        pt.planned_start_time,
        pt.estimated_duration,
        p.name as product_name,
        pt.requested_quantity,
        pt.status::VARCHAR(50) as status,
        pt.priority
    FROM production_tasks pt
    LEFT JOIN products p ON pt.product_id = p.id
    WHERE pt.planned_date IS NOT NULL 
      AND DATE(pt.planned_date) BETWEEN start_date AND end_date
    ORDER BY pt.planned_date, pt.planned_start_time NULLS LAST, pt.priority DESC;
END;
$$;


ALTER FUNCTION public.get_production_tasks_by_date_range(start_date date, end_date date) OWNER TO mikitavalkunovich;

--
-- Name: update_mat_area_trigger(); Type: FUNCTION; Schema: public; Owner: mikitavalkunovich
--

CREATE FUNCTION public.update_mat_area_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Обновляем mat_area только если оно NULL или не было установлено вручную
    -- (предполагаем, что если mat_area = calculated_area, то это автоматический расчет)
    IF NEW.dimensions IS NOT NULL AND 
       (OLD.mat_area IS NULL OR 
        OLD.mat_area = calculate_mat_area(OLD.dimensions) OR
        NEW.mat_area IS NULL) THEN
        NEW.mat_area := calculate_mat_area(NEW.dimensions);
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_mat_area_trigger() OWNER TO mikitavalkunovich;

--
-- Name: update_production_tasks_updated_at(); Type: FUNCTION; Schema: public; Owner: mikitavalkunovich
--

CREATE FUNCTION public.update_production_tasks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_production_tasks_updated_at() OWNER TO mikitavalkunovich;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id integer NOT NULL,
    operation public.audit_operation NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_log OWNER TO mikitavalkunovich;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_log_id_seq OWNER TO mikitavalkunovich;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    parent_id integer,
    path text,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.categories OWNER TO mikitavalkunovich;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 14
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categories_id_seq OWNER TO mikitavalkunovich;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: cutting_operations; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.cutting_operations (
    id integer NOT NULL,
    source_product_id integer NOT NULL,
    target_product_id integer NOT NULL,
    source_quantity integer NOT NULL,
    target_quantity integer NOT NULL,
    waste_quantity integer DEFAULT 0,
    status public.cutting_status DEFAULT 'planned'::public.cutting_status,
    operator_id integer,
    planned_date timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    assigned_to integer
);


ALTER TABLE public.cutting_operations OWNER TO mikitavalkunovich;

--
-- Name: cutting_operations_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.cutting_operations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cutting_operations_id_seq OWNER TO mikitavalkunovich;

--
-- Name: cutting_operations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.cutting_operations_id_seq OWNED BY public.cutting_operations.id;


--
-- Name: defect_products; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.defect_products (
    id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    defect_type character varying(100),
    defect_reason text,
    status public.defect_status DEFAULT 'identified'::public.defect_status,
    decision text,
    processed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.defect_products OWNER TO mikitavalkunovich;

--
-- Name: defect_products_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.defect_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.defect_products_id_seq OWNER TO mikitavalkunovich;

--
-- Name: defect_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.defect_products_id_seq OWNED BY public.defect_products.id;


--
-- Name: operation_reversals; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.operation_reversals (
    id integer NOT NULL,
    audit_log_id integer NOT NULL,
    reversal_reason text,
    reversed_by integer,
    reversed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.operation_reversals OWNER TO mikitavalkunovich;

--
-- Name: operation_reversals_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.operation_reversals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.operation_reversals_id_seq OWNER TO mikitavalkunovich;

--
-- Name: operation_reversals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.operation_reversals_id_seq OWNED BY public.operation_reversals.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    reserved_quantity integer DEFAULT 0,
    price numeric(10,2),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.order_items OWNER TO mikitavalkunovich;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_items_id_seq OWNER TO mikitavalkunovich;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_messages; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.order_messages (
    id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.order_messages OWNER TO mikitavalkunovich;

--
-- Name: order_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.order_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_messages_id_seq OWNER TO mikitavalkunovich;

--
-- Name: order_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.order_messages_id_seq OWNED BY public.order_messages.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number character varying(50) NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_contact character varying(255),
    status public.order_status DEFAULT 'new'::public.order_status,
    priority public.priority_level DEFAULT 'normal'::public.priority_level,
    delivery_date timestamp without time zone,
    manager_id integer,
    total_amount numeric(12,2),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    source public.order_source DEFAULT 'database'::public.order_source,
    custom_source character varying(255)
);


ALTER TABLE public.orders OWNER TO mikitavalkunovich;

--
-- Name: COLUMN orders.source; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.orders.source IS 'Источник заказа: database - из базы клиентов, website - с сайта, avito - с Авито, referral - по рекомендации, cold_call - холодные звонки, other - другое';


--
-- Name: COLUMN orders.custom_source; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.orders.custom_source IS 'Описание источника если выбрано "other"';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO mikitavalkunovich;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.permissions OWNER TO mikitavalkunovich;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.permissions_id_seq OWNER TO mikitavalkunovich;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: product_logos; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.product_logos (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_logos OWNER TO mikitavalkunovich;

--
-- Name: product_logos_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.product_logos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_logos_id_seq OWNER TO mikitavalkunovich;

--
-- Name: product_logos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.product_logos_id_seq OWNED BY public.product_logos.id;


--
-- Name: product_materials; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.product_materials (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_materials OWNER TO mikitavalkunovich;

--
-- Name: product_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.product_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_materials_id_seq OWNER TO mikitavalkunovich;

--
-- Name: product_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.product_materials_id_seq OWNED BY public.product_materials.id;


--
-- Name: product_relations; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.product_relations (
    id integer NOT NULL,
    product_id integer NOT NULL,
    related_product_id integer NOT NULL,
    relation_type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_relations OWNER TO mikitavalkunovich;

--
-- Name: product_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.product_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_relations_id_seq OWNER TO mikitavalkunovich;

--
-- Name: product_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.product_relations_id_seq OWNED BY public.product_relations.id;


--
-- Name: product_surfaces; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.product_surfaces (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_surfaces OWNER TO mikitavalkunovich;

--
-- Name: product_surfaces_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.product_surfaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_surfaces_id_seq OWNER TO mikitavalkunovich;

--
-- Name: product_surfaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.product_surfaces_id_seq OWNED BY public.product_surfaces.id;


--
-- Name: production_queue; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.production_queue (
    id integer NOT NULL,
    order_id integer,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    priority integer DEFAULT 1,
    estimated_start_date timestamp without time zone,
    estimated_completion_date timestamp without time zone,
    actual_start_date timestamp without time zone,
    actual_completion_date timestamp without time zone,
    status public.production_status DEFAULT 'queued'::public.production_status,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.production_queue OWNER TO mikitavalkunovich;

--
-- Name: production_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.production_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.production_queue_id_seq OWNER TO mikitavalkunovich;

--
-- Name: production_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.production_queue_id_seq OWNED BY public.production_queue.id;


--
-- Name: production_task_extras; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.production_task_extras (
    id integer NOT NULL,
    task_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.production_task_extras OWNER TO mikitavalkunovich;

--
-- Name: TABLE production_task_extras; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON TABLE public.production_task_extras IS 'Дополнительные товары при завершении производственных заданий';


--
-- Name: production_task_extras_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.production_task_extras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.production_task_extras_id_seq OWNER TO mikitavalkunovich;

--
-- Name: production_task_extras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.production_task_extras_id_seq OWNED BY public.production_task_extras.id;


--
-- Name: production_tasks; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.production_tasks (
    id integer NOT NULL,
    order_id integer,
    product_id integer NOT NULL,
    requested_quantity integer NOT NULL,
    produced_quantity integer DEFAULT 0,
    quality_quantity integer DEFAULT 0,
    defect_quantity integer DEFAULT 0,
    status public.production_task_status DEFAULT 'pending'::public.production_task_status,
    priority integer DEFAULT 1,
    sort_order integer DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_by integer,
    completed_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    assigned_to integer,
    started_by integer,
    planned_date timestamp without time zone,
    planned_start_time character varying(8) DEFAULT NULL::character varying
);


ALTER TABLE public.production_tasks OWNER TO mikitavalkunovich;

--
-- Name: TABLE production_tasks; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON TABLE public.production_tasks IS 'Таблица производственных заданий с календарным планированием (без оценки длительности)';


--
-- Name: COLUMN production_tasks.order_id; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.order_id IS 'ID заказа (необязательно - задания могут быть созданы на будущее без привязки к заказу)';


--
-- Name: COLUMN production_tasks.requested_quantity; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.requested_quantity IS 'Запрошенное количество';


--
-- Name: COLUMN production_tasks.produced_quantity; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.produced_quantity IS 'Произведенное количество';


--
-- Name: COLUMN production_tasks.quality_quantity; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.quality_quantity IS 'Количество годных изделий';


--
-- Name: COLUMN production_tasks.defect_quantity; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.defect_quantity IS 'Количество брака';


--
-- Name: COLUMN production_tasks.sort_order; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.sort_order IS 'Порядок сортировки для drag-and-drop';


--
-- Name: COLUMN production_tasks.planned_date; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.planned_date IS 'Планируемая дата выполнения задания';


--
-- Name: COLUMN production_tasks.planned_start_time; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.production_tasks.planned_start_time IS 'Планируемое время начала выполнения в формате HH:MM (например, 09:30)';


--
-- Name: production_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.production_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.production_tasks_id_seq OWNER TO mikitavalkunovich;

--
-- Name: production_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.production_tasks_id_seq OWNED BY public.production_tasks.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(500) NOT NULL,
    article character varying(100),
    category_id integer,
    dimensions jsonb,
    characteristics jsonb,
    tags text[],
    price numeric(10,2),
    cost_price numeric(10,2),
    norm_stock integer DEFAULT 0,
    notes text,
    photos text[],
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    surface_id integer,
    logo_id integer,
    material_id integer,
    manager_id integer,
    puzzle_options jsonb,
    mat_area numeric(10,4) DEFAULT NULL::numeric,
    weight numeric(8,3) DEFAULT NULL::numeric,
    grade public.product_grade DEFAULT 'usual'::public.product_grade,
    border_type public.border_type
);


ALTER TABLE public.products OWNER TO mikitavalkunovich;

--
-- Name: COLUMN products.puzzle_options; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.products.puzzle_options IS 'Опции для поверхности "Паззл": {sides: "1_side|2_sides|3_sides|4_sides", type: "old|old_04_2025|new|narrow|wide", enabled: boolean}';


--
-- Name: COLUMN products.mat_area; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.products.mat_area IS 'Площадь мата в квадратных метрах. Автоматически рассчитывается как (length * width) / 1000000, но может быть откорректирована вручную';


--
-- Name: COLUMN products.weight; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.products.weight IS 'Вес товара в килограммах (опционально)';


--
-- Name: COLUMN products.grade; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.products.grade IS 'Сорт товара: usual (обычный) или grade_2 (2 сорт)';


--
-- Name: COLUMN products.border_type; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON COLUMN public.products.border_type IS 'Наличие борта: with_border (с бортом) или without_border (без борта)';


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.products_id_seq OWNER TO mikitavalkunovich;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: puzzle_types; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.puzzle_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.puzzle_types OWNER TO mikitavalkunovich;

--
-- Name: TABLE puzzle_types; Type: COMMENT; Schema: public; Owner: mikitavalkunovich
--

COMMENT ON TABLE public.puzzle_types IS 'Справочник типов паззлов для динамического управления в интерфейсе';


--
-- Name: puzzle_types_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.puzzle_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.puzzle_types_id_seq OWNER TO mikitavalkunovich;

--
-- Name: puzzle_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.puzzle_types_id_seq OWNED BY public.puzzle_types.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role public.user_role NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.role_permissions OWNER TO mikitavalkunovich;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.role_permissions_id_seq OWNER TO mikitavalkunovich;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: shipment_items; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.shipment_items (
    id integer NOT NULL,
    shipment_id integer NOT NULL,
    product_id integer NOT NULL,
    planned_quantity integer NOT NULL,
    actual_quantity integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shipment_items OWNER TO mikitavalkunovich;

--
-- Name: shipment_items_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.shipment_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shipment_items_id_seq OWNER TO mikitavalkunovich;

--
-- Name: shipment_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.shipment_items_id_seq OWNED BY public.shipment_items.id;


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.shipments (
    id integer NOT NULL,
    shipment_number character varying(50) NOT NULL,
    order_id integer,
    planned_date timestamp without time zone,
    actual_date timestamp without time zone,
    transport_info text,
    status public.shipment_status DEFAULT 'pending'::public.shipment_status,
    documents_photos text[],
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shipments OWNER TO mikitavalkunovich;

--
-- Name: shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shipments_id_seq OWNER TO mikitavalkunovich;

--
-- Name: shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.shipments_id_seq OWNED BY public.shipments.id;


--
-- Name: stock; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.stock (
    id integer NOT NULL,
    product_id integer NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reserved_stock integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.stock OWNER TO mikitavalkunovich;

--
-- Name: stock_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.stock_id_seq OWNER TO mikitavalkunovich;

--
-- Name: stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.stock_id_seq OWNED BY public.stock.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.stock_movements (
    id integer NOT NULL,
    product_id integer NOT NULL,
    movement_type public.movement_type NOT NULL,
    quantity integer NOT NULL,
    reference_id integer,
    reference_type character varying(50),
    comment text,
    user_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.stock_movements OWNER TO mikitavalkunovich;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.stock_movements_id_seq OWNER TO mikitavalkunovich;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: telegram_notifications; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.telegram_notifications (
    id integer NOT NULL,
    user_id integer,
    message_type character varying(50),
    message_text text,
    sent_at timestamp without time zone,
    status public.notification_status DEFAULT 'pending'::public.notification_status
);


ALTER TABLE public.telegram_notifications OWNER TO mikitavalkunovich;

--
-- Name: telegram_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.telegram_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.telegram_notifications_id_seq OWNER TO mikitavalkunovich;

--
-- Name: telegram_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.telegram_notifications_id_seq OWNED BY public.telegram_notifications.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_id integer NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_permissions OWNER TO mikitavalkunovich;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_permissions_id_seq OWNER TO mikitavalkunovich;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: mikitavalkunovich
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    telegram_id character varying(50),
    full_name character varying(255),
    phone character varying(20),
    email character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO mikitavalkunovich;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: mikitavalkunovich
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO mikitavalkunovich;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mikitavalkunovich
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: cutting_operations id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.cutting_operations ALTER COLUMN id SET DEFAULT nextval('public.cutting_operations_id_seq'::regclass);


--
-- Name: defect_products id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.defect_products ALTER COLUMN id SET DEFAULT nextval('public.defect_products_id_seq'::regclass);


--
-- Name: operation_reversals id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.operation_reversals ALTER COLUMN id SET DEFAULT nextval('public.operation_reversals_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_messages id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_messages ALTER COLUMN id SET DEFAULT nextval('public.order_messages_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: product_logos id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_logos ALTER COLUMN id SET DEFAULT nextval('public.product_logos_id_seq'::regclass);


--
-- Name: product_materials id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_materials ALTER COLUMN id SET DEFAULT nextval('public.product_materials_id_seq'::regclass);


--
-- Name: product_relations id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_relations ALTER COLUMN id SET DEFAULT nextval('public.product_relations_id_seq'::regclass);


--
-- Name: product_surfaces id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_surfaces ALTER COLUMN id SET DEFAULT nextval('public.product_surfaces_id_seq'::regclass);


--
-- Name: production_queue id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_queue ALTER COLUMN id SET DEFAULT nextval('public.production_queue_id_seq'::regclass);


--
-- Name: production_task_extras id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_task_extras ALTER COLUMN id SET DEFAULT nextval('public.production_task_extras_id_seq'::regclass);


--
-- Name: production_tasks id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks ALTER COLUMN id SET DEFAULT nextval('public.production_tasks_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: puzzle_types id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.puzzle_types ALTER COLUMN id SET DEFAULT nextval('public.puzzle_types_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: shipment_items id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipment_items ALTER COLUMN id SET DEFAULT nextval('public.shipment_items_id_seq'::regclass);


--
-- Name: shipments id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipments ALTER COLUMN id SET DEFAULT nextval('public.shipments_id_seq'::regclass);


--
-- Name: stock id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock ALTER COLUMN id SET DEFAULT nextval('public.stock_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: telegram_notifications id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.telegram_notifications ALTER COLUMN id SET DEFAULT nextval('public.telegram_notifications_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: cutting_operations cutting_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_pkey PRIMARY KEY (id);


--
-- Name: defect_products defect_products_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.defect_products
    ADD CONSTRAINT defect_products_pkey PRIMARY KEY (id);


--
-- Name: operation_reversals operation_reversals_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.operation_reversals
    ADD CONSTRAINT operation_reversals_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_messages order_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_unique UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: product_logos product_logos_name_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_logos
    ADD CONSTRAINT product_logos_name_unique UNIQUE (name);


--
-- Name: product_logos product_logos_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_logos
    ADD CONSTRAINT product_logos_pkey PRIMARY KEY (id);


--
-- Name: product_materials product_materials_name_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_name_unique UNIQUE (name);


--
-- Name: product_materials product_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_pkey PRIMARY KEY (id);


--
-- Name: product_relations product_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_relations
    ADD CONSTRAINT product_relations_pkey PRIMARY KEY (id);


--
-- Name: product_surfaces product_surfaces_name_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_surfaces
    ADD CONSTRAINT product_surfaces_name_unique UNIQUE (name);


--
-- Name: product_surfaces product_surfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_surfaces
    ADD CONSTRAINT product_surfaces_pkey PRIMARY KEY (id);


--
-- Name: production_queue production_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_queue
    ADD CONSTRAINT production_queue_pkey PRIMARY KEY (id);


--
-- Name: production_task_extras production_task_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_task_extras
    ADD CONSTRAINT production_task_extras_pkey PRIMARY KEY (id);


--
-- Name: production_tasks production_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_pkey PRIMARY KEY (id);


--
-- Name: products products_article_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_article_unique UNIQUE (article);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: puzzle_types puzzle_types_code_key; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.puzzle_types
    ADD CONSTRAINT puzzle_types_code_key UNIQUE (code);


--
-- Name: puzzle_types puzzle_types_name_key; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.puzzle_types
    ADD CONSTRAINT puzzle_types_name_key UNIQUE (name);


--
-- Name: puzzle_types puzzle_types_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.puzzle_types
    ADD CONSTRAINT puzzle_types_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: shipment_items shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_shipment_number_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_shipment_number_unique UNIQUE (shipment_number);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: stock stock_product_id_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_unique UNIQUE (product_id);


--
-- Name: telegram_notifications telegram_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.telegram_notifications
    ADD CONSTRAINT telegram_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: idx_production_tasks_planned_date; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_production_tasks_planned_date ON public.production_tasks USING btree (planned_date) WHERE (planned_date IS NOT NULL);


--
-- Name: idx_production_tasks_planned_date_status; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_production_tasks_planned_date_status ON public.production_tasks USING btree (planned_date, status) WHERE (planned_date IS NOT NULL);


--
-- Name: idx_products_border_type; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_products_border_type ON public.products USING btree (border_type);


--
-- Name: idx_products_grade; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_products_grade ON public.products USING btree (grade);


--
-- Name: idx_products_mat_area; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_products_mat_area ON public.products USING btree (mat_area) WHERE (mat_area IS NOT NULL);


--
-- Name: idx_products_puzzle_options; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_products_puzzle_options ON public.products USING gin (puzzle_options) WHERE (puzzle_options IS NOT NULL);


--
-- Name: idx_products_weight; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_products_weight ON public.products USING btree (weight);


--
-- Name: idx_puzzle_types_code; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_puzzle_types_code ON public.puzzle_types USING btree (code);


--
-- Name: idx_puzzle_types_system; Type: INDEX; Schema: public; Owner: mikitavalkunovich
--

CREATE INDEX idx_puzzle_types_system ON public.puzzle_types USING btree (is_system);


--
-- Name: production_tasks trigger_production_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: mikitavalkunovich
--

CREATE TRIGGER trigger_production_tasks_updated_at BEFORE UPDATE ON public.production_tasks FOR EACH ROW EXECUTE FUNCTION public.update_production_tasks_updated_at();


--
-- Name: products trigger_update_mat_area; Type: TRIGGER; Schema: public; Owner: mikitavalkunovich
--

CREATE TRIGGER trigger_update_mat_area BEFORE INSERT OR UPDATE OF dimensions ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_mat_area_trigger();


--
-- Name: audit_log audit_log_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cutting_operations cutting_operations_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: cutting_operations cutting_operations_operator_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_operator_id_users_id_fk FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- Name: cutting_operations cutting_operations_source_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_source_product_id_products_id_fk FOREIGN KEY (source_product_id) REFERENCES public.products(id);


--
-- Name: cutting_operations cutting_operations_target_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_target_product_id_products_id_fk FOREIGN KEY (target_product_id) REFERENCES public.products(id);


--
-- Name: defect_products defect_products_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.defect_products
    ADD CONSTRAINT defect_products_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: operation_reversals operation_reversals_audit_log_id_audit_log_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.operation_reversals
    ADD CONSTRAINT operation_reversals_audit_log_id_audit_log_id_fk FOREIGN KEY (audit_log_id) REFERENCES public.audit_log(id);


--
-- Name: operation_reversals operation_reversals_reversed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.operation_reversals
    ADD CONSTRAINT operation_reversals_reversed_by_users_id_fk FOREIGN KEY (reversed_by) REFERENCES public.users(id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_messages order_messages_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_messages order_messages_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: orders orders_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: product_relations product_relations_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_relations
    ADD CONSTRAINT product_relations_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_relations product_relations_related_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.product_relations
    ADD CONSTRAINT product_relations_related_product_id_products_id_fk FOREIGN KEY (related_product_id) REFERENCES public.products(id);


--
-- Name: production_queue production_queue_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_queue
    ADD CONSTRAINT production_queue_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: production_queue production_queue_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_queue
    ADD CONSTRAINT production_queue_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_task_extras production_task_extras_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_task_extras
    ADD CONSTRAINT production_task_extras_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_task_extras production_task_extras_task_id_production_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_task_extras
    ADD CONSTRAINT production_task_extras_task_id_production_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.production_tasks(id);


--
-- Name: production_tasks production_tasks_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: production_tasks production_tasks_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_tasks production_tasks_started_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_started_by_users_id_fk FOREIGN KEY (started_by) REFERENCES public.users(id);


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_logo_id_product_logos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_logo_id_product_logos_id_fk FOREIGN KEY (logo_id) REFERENCES public.product_logos(id);


--
-- Name: products products_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: products products_material_id_product_materials_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_material_id_product_materials_id_fk FOREIGN KEY (material_id) REFERENCES public.product_materials(id);


--
-- Name: products products_surface_id_product_surfaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_surface_id_product_surfaces_id_fk FOREIGN KEY (surface_id) REFERENCES public.product_surfaces(id);


--
-- Name: role_permissions role_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: shipment_items shipment_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: shipment_items shipment_items_shipment_id_shipments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_shipment_id_shipments_id_fk FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: shipments shipments_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: shipments shipments_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: stock_movements stock_movements_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_movements stock_movements_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stock stock_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: telegram_notifications telegram_notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.telegram_notifications
    ADD CONSTRAINT telegram_notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: user_permissions user_permissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: mikitavalkunovich
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

