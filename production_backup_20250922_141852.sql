--
-- PostgreSQL database dump
--

\restrict blveAZ4yE3aov4Kttpd5S6nVrtA4i8uT4PJTlUJAD9aomlaFX1wosv5PoczIFNU

-- Dumped from database version 16.8 (Debian 16.8-1.pgdg120+1)
-- Dumped by pg_dump version 16.10 (Homebrew)

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
-- Name: audit_operation; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.audit_operation AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
);


ALTER TYPE public.audit_operation OWNER TO postgres;

--
-- Name: border_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.border_type AS ENUM (
    'with_border',
    'without_border'
);


ALTER TYPE public.border_type OWNER TO postgres;

--
-- Name: bottom_type_code; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.bottom_type_code AS ENUM (
    'spike_0',
    'spike_2',
    'spike_5',
    'spike_7',
    'spike_11'
);


ALTER TYPE public.bottom_type_code OWNER TO postgres;

--
-- Name: carpet_edge_strength; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.carpet_edge_strength AS ENUM (
    'weak',
    'normal',
    'strong',
    'reinforced'
);


ALTER TYPE public.carpet_edge_strength OWNER TO postgres;

--
-- Name: carpet_edge_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.carpet_edge_type AS ENUM (
    'straight_cut',
    'puzzle',
    'podpuzzle',
    'litoy_puzzle',
    'direct_cut',
    'sub_puzzle',
    'cast_puzzle'
);


ALTER TYPE public.carpet_edge_type OWNER TO postgres;

--
-- Name: cutting_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cutting_status AS ENUM (
    'planned',
    'approved',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);


ALTER TYPE public.cutting_status OWNER TO postgres;

--
-- Name: defect_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.defect_status AS ENUM (
    'identified',
    'under_review',
    'for_repair',
    'for_rework',
    'written_off'
);


ALTER TYPE public.defect_status OWNER TO postgres;

--
-- Name: movement_type; Type: TYPE; Schema: public; Owner: postgres
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


ALTER TYPE public.movement_type OWNER TO postgres;

--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_status AS ENUM (
    'pending',
    'sent',
    'failed'
);


ALTER TYPE public.notification_status OWNER TO postgres;

--
-- Name: order_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_source AS ENUM (
    'database',
    'website',
    'avito',
    'referral',
    'cold_call',
    'other'
);


ALTER TYPE public.order_source OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'new',
    'confirmed',
    'in_production',
    'ready',
    'completed',
    'cancelled'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: press_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.press_type AS ENUM (
    'not_selected',
    'ukrainian',
    'chinese'
);


ALTER TYPE public.press_type OWNER TO postgres;

--
-- Name: priority_level; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.priority_level AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE public.priority_level OWNER TO postgres;

--
-- Name: product_grade; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_grade AS ENUM (
    'usual',
    'grade_2',
    'telyatnik',
    'liber'
);


ALTER TYPE public.product_grade OWNER TO postgres;

--
-- Name: product_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_type AS ENUM (
    'carpet',
    'other',
    'pur',
    'roll_covering'
);


ALTER TYPE public.product_type OWNER TO postgres;

--
-- Name: production_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.production_status AS ENUM (
    'queued',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.production_status OWNER TO postgres;

--
-- Name: production_task_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.production_task_status AS ENUM (
    'pending',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);


ALTER TYPE public.production_task_status OWNER TO postgres;

--
-- Name: shipment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shipment_status AS ENUM (
    'pending',
    'completed',
    'cancelled',
    'paused'
);


ALTER TYPE public.shipment_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'manager',
    'director',
    'production',
    'warehouse'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: get_production_stats_by_day(date, date); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.get_production_stats_by_day(start_date date, end_date date) OWNER TO postgres;

--
-- Name: get_production_tasks_by_date_range(date, date); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.get_production_tasks_by_date_range(start_date date, end_date date) OWNER TO postgres;

--
-- Name: validate_surface_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_surface_ids() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Проверяем что все surface_ids существуют в таблице product_surfaces
    IF NEW.surface_ids IS NOT NULL THEN
        IF NOT (SELECT ARRAY[NEW.surface_ids] <@ ARRAY(SELECT id FROM product_surfaces)) THEN
            RAISE EXCEPTION 'Invalid surface_id in surface_ids array';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_surface_ids() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: bottom_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bottom_types (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bottom_types OWNER TO postgres;

--
-- Name: bottom_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bottom_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bottom_types_id_seq OWNER TO postgres;

--
-- Name: bottom_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bottom_types_id_seq OWNED BY public.bottom_types.id;


--
-- Name: carpet_edge_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carpet_edge_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.carpet_edge_types OWNER TO postgres;

--
-- Name: carpet_edge_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carpet_edge_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carpet_edge_types_id_seq OWNER TO postgres;

--
-- Name: carpet_edge_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carpet_edge_types_id_seq OWNED BY public.carpet_edge_types.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: cutting_operations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cutting_operations (
    id integer NOT NULL,
    source_product_id integer NOT NULL,
    target_product_id integer NOT NULL,
    source_quantity integer NOT NULL,
    target_quantity integer NOT NULL,
    waste_quantity integer DEFAULT 0,
    status public.cutting_status DEFAULT 'in_progress'::public.cutting_status,
    operator_id integer,
    assigned_to integer,
    planned_date timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    actual_second_grade_quantity integer DEFAULT 0
);


ALTER TABLE public.cutting_operations OWNER TO postgres;

--
-- Name: cutting_operations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cutting_operations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cutting_operations_id_seq OWNER TO postgres;

--
-- Name: cutting_operations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cutting_operations_id_seq OWNED BY public.cutting_operations.id;


--
-- Name: defect_products; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.defect_products OWNER TO postgres;

--
-- Name: defect_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.defect_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.defect_products_id_seq OWNER TO postgres;

--
-- Name: defect_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.defect_products_id_seq OWNED BY public.defect_products.id;


--
-- Name: operation_reversals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operation_reversals (
    id integer NOT NULL,
    audit_log_id integer NOT NULL,
    reversal_reason text,
    reversed_by integer,
    reversed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.operation_reversals OWNER TO postgres;

--
-- Name: operation_reversals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.operation_reversals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.operation_reversals_id_seq OWNER TO postgres;

--
-- Name: operation_reversals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.operation_reversals_id_seq OWNED BY public.operation_reversals.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_messages (
    id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.order_messages OWNER TO postgres;

--
-- Name: order_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_messages_id_seq OWNER TO postgres;

--
-- Name: order_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_messages_id_seq OWNED BY public.order_messages.id;


--
-- Name: order_number_sequence; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_number_sequence
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_number_sequence OWNER TO postgres;

--
-- Name: SEQUENCE order_number_sequence; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON SEQUENCE public.order_number_sequence IS 'Последовательность для генерации номеров заказов';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
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
    custom_source character varying(255),
    contract_number character varying(100)
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: COLUMN orders.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.source IS 'Источник заказа: database - из базы клиентов, website - с сайта, avito - с Авито, referral - по рекомендации, cold_call - холодные звонки, other - другое';


--
-- Name: COLUMN orders.custom_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.custom_source IS 'Описание источника если выбрано "other"';


--
-- Name: COLUMN orders.contract_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.contract_number IS 'Номер договора клиента';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO postgres;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: product_logos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_logos (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_logos OWNER TO postgres;

--
-- Name: product_logos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_logos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_logos_id_seq OWNER TO postgres;

--
-- Name: product_logos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_logos_id_seq OWNED BY public.product_logos.id;


--
-- Name: product_materials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_materials (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_materials OWNER TO postgres;

--
-- Name: product_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_materials_id_seq OWNER TO postgres;

--
-- Name: product_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_materials_id_seq OWNED BY public.product_materials.id;


--
-- Name: product_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_relations (
    id integer NOT NULL,
    product_id integer NOT NULL,
    related_product_id integer NOT NULL,
    relation_type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_relations OWNER TO postgres;

--
-- Name: product_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_relations_id_seq OWNER TO postgres;

--
-- Name: product_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_relations_id_seq OWNED BY public.product_relations.id;


--
-- Name: product_surfaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_surfaces (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.product_surfaces OWNER TO postgres;

--
-- Name: product_surfaces_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_surfaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_surfaces_id_seq OWNER TO postgres;

--
-- Name: product_surfaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_surfaces_id_seq OWNED BY public.product_surfaces.id;


--
-- Name: production_queue; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.production_queue OWNER TO postgres;

--
-- Name: production_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.production_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_queue_id_seq OWNER TO postgres;

--
-- Name: production_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.production_queue_id_seq OWNED BY public.production_queue.id;


--
-- Name: production_task_extras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_task_extras (
    id integer NOT NULL,
    task_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.production_task_extras OWNER TO postgres;

--
-- Name: production_task_extras_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.production_task_extras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_task_extras_id_seq OWNER TO postgres;

--
-- Name: production_task_extras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.production_task_extras_id_seq OWNED BY public.production_task_extras.id;


--
-- Name: production_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_tasks (
    id integer NOT NULL,
    order_id integer,
    product_id integer NOT NULL,
    requested_quantity integer NOT NULL,
    status public.production_task_status DEFAULT 'pending'::public.production_task_status,
    priority integer DEFAULT 1,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    produced_quantity integer DEFAULT 0,
    quality_quantity integer DEFAULT 0,
    defect_quantity integer DEFAULT 0,
    created_by integer,
    assigned_to integer,
    started_by integer,
    completed_by integer,
    notes text,
    updated_at timestamp without time zone DEFAULT now(),
    planned_date timestamp without time zone,
    planned_start_time character varying(8) DEFAULT NULL::character varying,
    estimated_duration integer,
    cancelled_by integer,
    cancel_reason text
);


ALTER TABLE public.production_tasks OWNER TO postgres;

--
-- Name: COLUMN production_tasks.planned_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.production_tasks.planned_date IS 'Планируемая дата выполнения задания';


--
-- Name: COLUMN production_tasks.planned_start_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.production_tasks.planned_start_time IS 'Планируемое время начала выполнения в формате HH:MM (например, 09:30)';


--
-- Name: COLUMN production_tasks.estimated_duration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.production_tasks.estimated_duration IS 'Ожидаемая продолжительность выполнения задания в минутах';


--
-- Name: COLUMN production_tasks.cancelled_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.production_tasks.cancelled_by IS 'ID пользователя, который отменил задание';


--
-- Name: COLUMN production_tasks.cancel_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.production_tasks.cancel_reason IS 'Причина отмены производственного задания';


--
-- Name: production_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.production_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_tasks_id_seq OWNER TO postgres;

--
-- Name: production_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.production_tasks_id_seq OWNED BY public.production_tasks.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(500) NOT NULL,
    article character varying(100),
    category_id integer,
    manager_id integer,
    surface_id integer,
    logo_id integer,
    material_id integer,
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
    weight numeric(8,3),
    puzzle_options jsonb,
    mat_area numeric,
    border_type public.border_type,
    carpet_edge_sides integer DEFAULT 1,
    carpet_edge_strength character varying(50) DEFAULT 'normal'::character varying,
    bottom_type_id integer,
    puzzle_type_id integer,
    puzzle_sides integer DEFAULT 1,
    grade public.product_grade DEFAULT 'usual'::public.product_grade,
    carpet_edge_type public.carpet_edge_type DEFAULT 'straight_cut'::public.carpet_edge_type,
    product_type public.product_type DEFAULT 'carpet'::public.product_type,
    pur_number integer,
    surface_ids integer[],
    press_type public.press_type DEFAULT 'not_selected'::public.press_type,
    CONSTRAINT products_pur_number_positive CHECK (((pur_number IS NULL) OR (pur_number > 0)))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: COLUMN products.weight; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.weight IS 'Вес товара в килограммах';


--
-- Name: COLUMN products.puzzle_options; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.puzzle_options IS 'Настройки паззла в формате JSON';


--
-- Name: COLUMN products.mat_area; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.mat_area IS 'Площадь коврика в квадратных метрах';


--
-- Name: COLUMN products.border_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.border_type IS 'Наличие борта: with_border (с бортом) или without_border (без борта)';


--
-- Name: COLUMN products.carpet_edge_sides; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.carpet_edge_sides IS 'Количество сторон для паззлового края';


--
-- Name: COLUMN products.carpet_edge_strength; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.carpet_edge_strength IS 'Усиление края: обычный или усиленный';


--
-- Name: COLUMN products.bottom_type_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.bottom_type_id IS 'Тип низа ковра (опциональное поле, может быть NULL)';


--
-- Name: COLUMN products.puzzle_type_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.puzzle_type_id IS 'Ссылка на тип паззла';


--
-- Name: COLUMN products.puzzle_sides; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.puzzle_sides IS 'Количество сторон паззла';


--
-- Name: COLUMN products.carpet_edge_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.carpet_edge_type IS 'Тип края ковра (straight_cut, puzzle, podpuzzle, litoy_puzzle)';


--
-- Name: COLUMN products.product_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.product_type IS 'Тип товара: carpet, other, pur, roll_covering';


--
-- Name: COLUMN products.pur_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.pur_number IS 'Номер ПУР товара (только для типа pur)';


--
-- Name: COLUMN products.surface_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.surface_ids IS 'Массив ID поверхностей (множественный выбор)';


--
-- Name: COLUMN products.press_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.press_type IS 'Тип пресса: не выбрано, украинский, китайский';


--
-- Name: products_bottom_type_fix_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products_bottom_type_fix_backup (
    id integer,
    article character varying(100),
    bottom_type_id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.products_bottom_type_fix_backup OWNER TO postgres;

--
-- Name: products_carpet_edge_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products_carpet_edge_backup (
    id integer,
    article character varying(100),
    name character varying(500),
    carpet_edge_type public.carpet_edge_type,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.products_carpet_edge_backup OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: puzzle_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.puzzle_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.puzzle_types OWNER TO postgres;

--
-- Name: TABLE puzzle_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.puzzle_types IS 'Справочник типов паззлов для динамического управления в интерфейсе';


--
-- Name: puzzle_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.puzzle_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.puzzle_types_id_seq OWNER TO postgres;

--
-- Name: puzzle_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.puzzle_types_id_seq OWNED BY public.puzzle_types.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role public.user_role NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roll_covering_composition; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roll_covering_composition (
    id integer NOT NULL,
    roll_covering_id integer NOT NULL,
    carpet_id integer NOT NULL,
    quantity numeric(10,2) NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT check_no_self_reference CHECK ((roll_covering_id <> carpet_id)),
    CONSTRAINT check_quantity_positive CHECK ((quantity >= 0.01)),
    CONSTRAINT check_sort_order_positive CHECK ((sort_order >= 0)),
    CONSTRAINT roll_covering_composition_quantity_positive CHECK ((quantity > (0)::numeric)),
    CONSTRAINT roll_covering_composition_sort_order_positive CHECK ((sort_order >= 0))
);


ALTER TABLE public.roll_covering_composition OWNER TO postgres;

--
-- Name: TABLE roll_covering_composition; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roll_covering_composition IS 'Состав рулонных покрытий - связь рулонного покрытия с коврами';


--
-- Name: COLUMN roll_covering_composition.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.roll_covering_composition.quantity IS 'Количество данного ковра в составе (поддерживает дробные значения до 2 знаков после запятой)';


--
-- Name: roll_covering_composition_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roll_covering_composition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roll_covering_composition_id_seq OWNER TO postgres;

--
-- Name: roll_covering_composition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roll_covering_composition_id_seq OWNED BY public.roll_covering_composition.id;


--
-- Name: shipment_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipment_items (
    id integer NOT NULL,
    shipment_id integer NOT NULL,
    product_id integer NOT NULL,
    planned_quantity integer NOT NULL,
    actual_quantity integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shipment_items OWNER TO postgres;

--
-- Name: shipment_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shipment_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipment_items_id_seq OWNER TO postgres;

--
-- Name: shipment_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shipment_items_id_seq OWNED BY public.shipment_items.id;


--
-- Name: shipment_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipment_orders (
    id integer NOT NULL,
    shipment_id integer NOT NULL,
    order_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shipment_orders OWNER TO postgres;

--
-- Name: TABLE shipment_orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.shipment_orders IS 'Связь many-to-many между отгрузками и заказами';


--
-- Name: COLUMN shipment_orders.shipment_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipment_orders.shipment_id IS 'ID отгрузки';


--
-- Name: COLUMN shipment_orders.order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipment_orders.order_id IS 'ID заказа';


--
-- Name: COLUMN shipment_orders.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shipment_orders.created_at IS 'Дата создания связи';


--
-- Name: shipment_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shipment_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipment_orders_id_seq OWNER TO postgres;

--
-- Name: shipment_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shipment_orders_id_seq OWNED BY public.shipment_orders.id;


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shipments (
    id integer NOT NULL,
    shipment_number character varying(50) NOT NULL,
    planned_date timestamp without time zone,
    actual_date timestamp without time zone,
    transport_info text,
    status public.shipment_status DEFAULT 'pending'::public.shipment_status,
    documents_photos text[],
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.shipments OWNER TO postgres;

--
-- Name: shipments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipments_id_seq OWNER TO postgres;

--
-- Name: shipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shipments_id_seq OWNED BY public.shipments.id;


--
-- Name: stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock (
    id integer NOT NULL,
    product_id integer NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reserved_stock integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.stock OWNER TO postgres;

--
-- Name: stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_id_seq OWNER TO postgres;

--
-- Name: stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_id_seq OWNED BY public.stock.id;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movements_id_seq OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: telegram_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telegram_notifications (
    id integer NOT NULL,
    user_id integer,
    message_type character varying(50),
    message_text text,
    sent_at timestamp without time zone,
    status public.notification_status DEFAULT 'pending'::public.notification_status
);


ALTER TABLE public.telegram_notifications OWNER TO postgres;

--
-- Name: telegram_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.telegram_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telegram_notifications_id_seq OWNER TO postgres;

--
-- Name: telegram_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.telegram_notifications_id_seq OWNED BY public.telegram_notifications.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_id integer NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_permissions_id_seq OWNER TO postgres;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: bottom_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bottom_types ALTER COLUMN id SET DEFAULT nextval('public.bottom_types_id_seq'::regclass);


--
-- Name: carpet_edge_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carpet_edge_types ALTER COLUMN id SET DEFAULT nextval('public.carpet_edge_types_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: cutting_operations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cutting_operations ALTER COLUMN id SET DEFAULT nextval('public.cutting_operations_id_seq'::regclass);


--
-- Name: defect_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_products ALTER COLUMN id SET DEFAULT nextval('public.defect_products_id_seq'::regclass);


--
-- Name: operation_reversals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operation_reversals ALTER COLUMN id SET DEFAULT nextval('public.operation_reversals_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_messages ALTER COLUMN id SET DEFAULT nextval('public.order_messages_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: product_logos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_logos ALTER COLUMN id SET DEFAULT nextval('public.product_logos_id_seq'::regclass);


--
-- Name: product_materials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_materials ALTER COLUMN id SET DEFAULT nextval('public.product_materials_id_seq'::regclass);


--
-- Name: product_relations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_relations ALTER COLUMN id SET DEFAULT nextval('public.product_relations_id_seq'::regclass);


--
-- Name: product_surfaces id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_surfaces ALTER COLUMN id SET DEFAULT nextval('public.product_surfaces_id_seq'::regclass);


--
-- Name: production_queue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_queue ALTER COLUMN id SET DEFAULT nextval('public.production_queue_id_seq'::regclass);


--
-- Name: production_task_extras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_task_extras ALTER COLUMN id SET DEFAULT nextval('public.production_task_extras_id_seq'::regclass);


--
-- Name: production_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks ALTER COLUMN id SET DEFAULT nextval('public.production_tasks_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: puzzle_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.puzzle_types ALTER COLUMN id SET DEFAULT nextval('public.puzzle_types_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roll_covering_composition id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roll_covering_composition ALTER COLUMN id SET DEFAULT nextval('public.roll_covering_composition_id_seq'::regclass);


--
-- Name: shipment_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_items ALTER COLUMN id SET DEFAULT nextval('public.shipment_items_id_seq'::regclass);


--
-- Name: shipment_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_orders ALTER COLUMN id SET DEFAULT nextval('public.shipment_orders_id_seq'::regclass);


--
-- Name: shipments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments ALTER COLUMN id SET DEFAULT nextval('public.shipments_id_seq'::regclass);


--
-- Name: stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock ALTER COLUMN id SET DEFAULT nextval('public.stock_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: telegram_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_notifications ALTER COLUMN id SET DEFAULT nextval('public.telegram_notifications_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log (id, table_name, record_id, operation, old_values, new_values, user_id, created_at) FROM stdin;
1	products	7	UPDATE	{"id": 7, "name": "Тест grade_2", "tags": null, "grade": "grade_2", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": null, "matArea": null, "isActive": true, "costPrice": null, "createdAt": "2025-08-21T06:35:57.762Z", "managerId": null, "normStock": 0, "surfaceId": null, "updatedAt": "2025-08-21T06:35:57.762Z", "borderType": null, "categoryId": 2, "dimensions": {"width": 100, "length": 100, "thickness": 10}, "materialId": null, "puzzleSides": null, "bottomTypeId": 3, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "straight_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 7, "name": "Тест grade_2", "tags": null, "grade": "grade_2", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": null, "matArea": null, "isActive": false, "costPrice": null, "createdAt": "2025-08-21T06:35:57.762Z", "managerId": null, "normStock": 0, "surfaceId": null, "updatedAt": "2025-08-21T06:37:34.863Z", "borderType": null, "categoryId": 2, "dimensions": {"width": 100, "length": 100, "thickness": 10}, "materialId": null, "puzzleSides": null, "bottomTypeId": 3, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "straight_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-08-21 06:37:34.869
2	products	55	UPDATE	{"id": 55, "name": "мат", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "МАТ-2030x1190x24-ЧЕШУЙ-ШИП7-1СОРТ", "matArea": "2.4157", "isActive": true, "costPrice": null, "createdAt": "2025-08-22T07:17:31.871Z", "managerId": null, "normStock": 0, "surfaceId": 7, "updatedAt": "2025-08-22T07:17:31.871Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1190, "length": 2030, "thickness": 24}, "materialId": null, "puzzleSides": 4, "bottomTypeId": 4, "puzzleTypeId": 3, "puzzleOptions": null, "carpetEdgeType": "puzzle", "carpetEdgeSides": 4, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 55, "name": "мат", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "МАТ-2030x1190x24-ЧЕШУЙ-ШИП7-1СОРТ", "matArea": "2.4157", "isActive": false, "costPrice": null, "createdAt": "2025-08-22T07:17:31.871Z", "managerId": null, "normStock": 0, "surfaceId": 7, "updatedAt": "2025-08-27T13:12:47.771Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1190, "length": 2030, "thickness": 24}, "materialId": null, "puzzleSides": 4, "bottomTypeId": 4, "puzzleTypeId": 3, "puzzleOptions": null, "carpetEdgeType": "puzzle", "carpetEdgeSides": 4, "characteristics": null, "carpetEdgeStrength": "normal"}	6	2025-08-27 13:12:47.775
3	users	7	INSERT	\N	{"role": "manager", "isActive": true, "username": "tremolo"}	1	2025-08-28 08:39:40.682169
4	categories	4	INSERT	\N	{"id": 4, "name": "Другое", "path": "Другое", "parentId": null, "createdAt": "2025-09-01T09:14:08.553Z", "sortOrder": 0, "updatedAt": "2025-09-01T09:14:08.553Z", "description": null}	1	2025-09-01 09:14:08.562
5	products	1	UPDATE	{"categoryId": 1}	{"categoryId": 4}	1	2025-09-01 09:15:09.165
6	categories	1	DELETE	{"id": 1, "name": "Лежаки верблюды", "path": "Лежаки верблюды", "parentId": null, "createdAt": "2025-07-22T09:25:49.773Z", "sortOrder": 0, "updatedAt": "2025-07-22T09:25:49.803Z", "description": null}	\N	1	2025-09-01 09:15:09.214
7	products	116	UPDATE	{"id": 116, "name": "Тест", "tags": null, "grade": null, "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Тест-1", "matArea": null, "isActive": true, "costPrice": null, "createdAt": "2025-09-01T09:14:59.453Z", "managerId": null, "normStock": 0, "pressType": null, "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-01T09:15:09.143Z", "borderType": null, "categoryId": 4, "dimensions": null, "materialId": null, "surfaceIds": null, "productType": "other", "puzzleSides": null, "bottomTypeId": null, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": null, "carpetEdgeSides": null, "characteristics": null, "carpetEdgeStrength": null}	{"id": 116, "name": "Тест", "tags": null, "grade": null, "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Тест-1", "matArea": null, "isActive": false, "costPrice": null, "createdAt": "2025-09-01T09:14:59.453Z", "managerId": null, "normStock": 0, "pressType": null, "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-01T09:15:17.552Z", "borderType": null, "categoryId": 4, "dimensions": null, "materialId": null, "surfaceIds": null, "productType": "other", "puzzleSides": null, "bottomTypeId": null, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": null, "carpetEdgeSides": null, "characteristics": null, "carpetEdgeStrength": null}	1	2025-09-01 09:15:17.556
8	products	101	UPDATE	{"id": 101, "name": "ЛЕЖАК", "tags": null, "grade": "grade_2", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-ЧЕШУЙ-ЛИБЕР", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:25:52.733Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 101, "name": "ЛЕЖАК", "tags": null, "grade": "grade_2", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-ЧЕШУЙ-ЛИБЕР", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:25:52.733Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:19:29.874Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:19:29.884
29	users	8	INSERT	\N	{"role": "production", "isActive": true, "username": "Denis"}	1	2025-09-04 10:27:49.856213
9	products	96	UPDATE	{"id": 96, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖ-1800x1200x30-ЧЕШУЙ-не ус-УКР-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-22T12:30:02.581Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 96, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖ-1800x1200x30-ЧЕШУЙ-не ус-УКР-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-22T12:30:02.581Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:19:37.618Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:19:37.628
10	products	98	UPDATE	{"id": 98, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-ЧЕШУЙ-не ус-КИТ-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-22T12:56:21.220Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 98, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-ЧЕШУЙ-не ус-КИТ-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-22T12:56:21.220Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:19:44.564Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:19:44.568
11	products	102	UPDATE	{"id": 102, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x40-ЧЕШУЙ-не ус-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:42:22.887Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 40}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 102, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x40-ЧЕШУЙ-не ус-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:42:22.887Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:19:50.915Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 40}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:19:50.918
13	products	105	UPDATE	{"id": 105, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:50:11.163Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 105, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:50:11.163Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:20:09.524Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:20:09.529
30	products	186	UPDATE	{"article": "Леж - 2000x1190x24 - Чеш - 7Шип - Пазл1стСтар"}	{"article": "Леж - 2000x1190x24 - Чеш - Шип7 - Пазл1стСтар"}	1	2025-09-11 07:45:45.093372
12	products	103	UPDATE	{"id": 103, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x40-ЧЕШУЙ-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:45:47.574Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "without_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 40}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 103, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x40-ЧЕШУЙ-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:45:47.574Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:19:58.168Z", "borderType": "without_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 40}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:19:58.178
18	products	110	UPDATE	{"id": 110, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x35-1КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:08:26.068Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 9, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [9], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 110, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x35-1КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:08:26.068Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 9, "updatedAt": "2025-09-03T11:20:50.024Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [9], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:20:50.029
19	products	111	UPDATE	{"id": 111, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-1СОРТ", "matArea": "2.133", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:14:15.630Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 111, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-1СОРТ", "matArea": "2.133", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:14:15.630Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:20:55.449Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:20:55.455
20	products	104	UPDATE	{"id": 104, "name": "ЛЕЖАК", "tags": null, "grade": "grade_2", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-ЛИБЕР", "matArea": "2.133", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:47:57.480Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 104, "name": "ЛЕЖАК", "tags": null, "grade": "grade_2", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-ЛИБЕР", "matArea": "2.133", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:47:57.480Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:21:04.945Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:21:04.952
31	products	185	UPDATE	{"article": "Леж - 1800x1080x24 - Чеш - 7Шип - ПрямРез4ст"}	{"article": "Леж - 1800x1080x24 - Чеш - Шип7 - ПрямРез4ст"}	1	2025-09-11 07:46:32.129103
14	products	106	UPDATE	{"id": 106, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:51:29.965Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 106, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:51:29.965Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:20:17.296Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:20:17.303
15	products	107	UPDATE	{"id": 107, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-1СОРТ", "matArea": "2.133", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:53:14.179Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 107, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-1СОРТ", "matArea": "2.133", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:53:14.179Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:20:31.147Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:20:31.15
16	products	108	UPDATE	{"id": 108, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.133", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:55:25.825Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 108, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.133", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:55:25.825Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:20:38.403Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:20:38.406
17	products	109	UPDATE	{"id": 109, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x40-1КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:04:15.564Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 9, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 40}, "materialId": null, "surfaceIds": [9], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 109, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x40-1КОР-СБОРТ-не ус-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:04:15.564Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 9, "updatedAt": "2025-09-03T11:20:43.712Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 40}, "materialId": null, "surfaceIds": [9], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:20:43.719
21	products	97	UPDATE	{"id": 97, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x30-ЧЕШУЙ-СБОРТ-не ус-1СОРТ", "matArea": "2.133", "isActive": true, "costPrice": null, "createdAt": "2025-08-22T12:35:03.586Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 97, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1185x30-ЧЕШУЙ-СБОРТ-не ус-1СОРТ", "matArea": "2.133", "isActive": false, "costPrice": null, "createdAt": "2025-08-22T12:35:03.586Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:21:16.688Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1185, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:21:16.695
22	products	99	UPDATE	{"id": 99, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1195x35-ЧЕШУЙ-не ус-1СОРТ", "matArea": "2.151", "isActive": true, "costPrice": null, "createdAt": "2025-08-22T13:02:28.971Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1195, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 99, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1195x35-ЧЕШУЙ-не ус-1СОРТ", "matArea": "2.151", "isActive": false, "costPrice": null, "createdAt": "2025-08-22T13:02:28.971Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:21:21.632Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1195, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:21:21.64
23	products	115	UPDATE	{"id": 115, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1175x30-3КОР-БЕЗБОРТ-1СОРТ", "matArea": "2.115", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:22:14.394Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "without_border", "categoryId": 3, "dimensions": {"width": 1175, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 115, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1175x30-3КОР-БЕЗБОРТ-1СОРТ", "matArea": "2.115", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:22:14.394Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:21:27.352Z", "borderType": "without_border", "categoryId": 3, "dimensions": {"width": 1175, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:21:27.356
24	products	100	UPDATE	{"id": 100, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T06:12:30.249Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 100, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T06:12:30.249Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 7, "updatedAt": "2025-09-03T11:21:32.934Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [7], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:21:32.939
25	products	112	UPDATE	{"id": 112, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": 4, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-ЧЕШУЙ-СБОРТ-GEA-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:17:07.902Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 11, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [11], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 112, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": 4, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x30-ЧЕШУЙ-СБОРТ-GEA-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:17:07.902Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 11, "updatedAt": "2025-09-03T11:21:59.249Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [11], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-03 11:21:59.253
26	products	113	UPDATE	{"id": 113, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": 7, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-АГРОТ-1СОРТ", "matArea": "2.16", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:19:01.815Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 11, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [11], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 113, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": 7, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-АГРОТ-1СОРТ", "matArea": "2.16", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:19:01.815Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 11, "updatedAt": "2025-09-03T11:22:05.565Z", "borderType": "with_border", "categoryId": 3, "dimensions": {"width": 1200, "length": 1800, "thickness": 35}, "materialId": null, "surfaceIds": [11], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:22:05.568
27	products	114	UPDATE	{"id": 114, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1165x30-3КОР-1СОРТ", "matArea": "2.097", "isActive": true, "costPrice": null, "createdAt": "2025-08-25T07:20:44.806Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-02T19:09:20.182Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1165, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	{"id": 114, "name": "ЛЕЖАК", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "ЛЕЖАК-1800x1165x30-3КОР-1СОРТ", "matArea": "2.097", "isActive": false, "costPrice": null, "createdAt": "2025-08-25T07:20:44.806Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": 10, "updatedAt": "2025-09-03T11:22:11.536Z", "borderType": null, "categoryId": 3, "dimensions": {"width": 1165, "length": 1800, "thickness": 30}, "materialId": null, "surfaceIds": [10], "productType": "carpet", "puzzleSides": 1, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "direct_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "reinforced"}	1	2025-09-03 11:22:11.541
28	categories	4	UPDATE	{"id": 4, "name": "Другое", "path": "Другое", "parentId": null, "createdAt": "2025-09-01T09:14:08.553Z", "sortOrder": 0, "updatedAt": "2025-09-01T09:14:08.558Z", "description": null}	{"id": 4, "name": "Другое", "path": "Другое", "parentId": null, "createdAt": "2025-09-01T09:14:08.553Z", "sortOrder": 0, "updatedAt": "2025-09-03T12:28:34.310Z", "description": null}	1	2025-09-03 12:28:34.316
32	products	160	UPDATE	{"id": 160, "name": "Рулонное покр", "tags": null, "grade": null, "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Покрытие - 13000x1000x21 - Черт - 0Шип - 11Ковр", "matArea": "13", "isActive": true, "costPrice": null, "createdAt": "2025-09-04T11:34:34.428Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-04T11:34:34.428Z", "borderType": null, "categoryId": 2, "dimensions": {"width": 1000, "length": 13000, "thickness": 21}, "materialId": null, "surfaceIds": [6], "productType": "roll_covering", "puzzleSides": null, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": null, "carpetEdgeSides": null, "characteristics": null, "carpetEdgeStrength": null}	{"id": 160, "name": "Рулонное покр", "tags": null, "grade": null, "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Покрытие - 13000x1000x21 - Черт - 0Шип - 11Ковр", "matArea": "13", "isActive": false, "costPrice": null, "createdAt": "2025-09-04T11:34:34.428Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-11T10:49:10.663Z", "borderType": null, "categoryId": 2, "dimensions": {"width": 1000, "length": 13000, "thickness": 21}, "materialId": null, "surfaceIds": [6], "productType": "roll_covering", "puzzleSides": null, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": null, "carpetEdgeSides": null, "characteristics": null, "carpetEdgeStrength": null}	1	2025-09-11 10:49:10.694
33	products	159	UPDATE	{"id": 159, "name": "Рулонное покр", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Рул Покр - 25000x1000x21 - Черт - 0Шип - 21Ковр", "matArea": "25", "isActive": true, "costPrice": null, "createdAt": "2025-09-04T11:31:43.133Z", "managerId": null, "normStock": 0, "pressType": "chinese", "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-04T11:32:31.311Z", "borderType": "without_border", "categoryId": 2, "dimensions": {"width": 1000, "length": 25000, "thickness": 21}, "materialId": null, "surfaceIds": [6], "productType": "roll_covering", "puzzleSides": null, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "straight_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	{"id": 159, "name": "Рулонное покр", "tags": null, "grade": "usual", "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Рул Покр - 25000x1000x21 - Черт - 0Шип - 21Ковр", "matArea": "25", "isActive": false, "costPrice": null, "createdAt": "2025-09-04T11:31:43.133Z", "managerId": null, "normStock": 0, "pressType": "chinese", "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-11T10:49:14.617Z", "borderType": "without_border", "categoryId": 2, "dimensions": {"width": 1000, "length": 25000, "thickness": 21}, "materialId": null, "surfaceIds": [6], "productType": "roll_covering", "puzzleSides": null, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": "straight_cut", "carpetEdgeSides": 1, "characteristics": null, "carpetEdgeStrength": "normal"}	1	2025-09-11 10:49:14.621
34	products	161	UPDATE	{"id": 161, "name": "Рулонное покр", "tags": null, "grade": null, "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Покрытие - 18600x1000x21 - Черт - 0Шип - 15.5Ковр", "matArea": "18.6", "isActive": true, "costPrice": null, "createdAt": "2025-09-04T11:36:37.612Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-04T11:36:37.612Z", "borderType": null, "categoryId": 2, "dimensions": {"width": 1000, "length": 18600, "thickness": 21}, "materialId": null, "surfaceIds": [6], "productType": "roll_covering", "puzzleSides": null, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": null, "carpetEdgeSides": null, "characteristics": null, "carpetEdgeStrength": null}	{"id": 161, "name": "Рулонное покр", "tags": null, "grade": null, "notes": null, "price": null, "logoId": null, "photos": null, "weight": null, "article": "Покрытие - 18600x1000x21 - Черт - 0Шип - 15.5Ковр", "matArea": "18.6", "isActive": false, "costPrice": null, "createdAt": "2025-09-04T11:36:37.612Z", "managerId": null, "normStock": 0, "pressType": "not_selected", "purNumber": null, "surfaceId": null, "updatedAt": "2025-09-11T10:49:56.731Z", "borderType": null, "categoryId": 2, "dimensions": {"width": 1000, "length": 18600, "thickness": 21}, "materialId": null, "surfaceIds": [6], "productType": "roll_covering", "puzzleSides": null, "bottomTypeId": 1, "puzzleTypeId": null, "puzzleOptions": null, "carpetEdgeType": null, "carpetEdgeSides": null, "characteristics": null, "carpetEdgeStrength": null}	1	2025-09-11 10:49:56.735
35	users	9	INSERT	\N	{"role": "warehouse", "isActive": true, "username": "Vitluka"}	1	2025-09-12 08:31:00.696187
36	users	8	UPDATE	{"role": "production", "email": null, "fullName": "Денис", "isActive": true}	{"role": "warehouse", "email": null, "fullName": "Денис", "isActive": true}	1	2025-09-12 10:56:35.40094
37	orders	1	DELETE	{"id": 1, "items": [{"id": 1, "price": 4822.2, "orderId": 1, "quantity": 50, "createdAt": "2025-08-25T09:10:48.798Z", "productId": 90, "reservedQuantity": 50}], "notes": null, "source": "database", "status": "ready", "priority": "normal", "createdAt": "2025-08-25T09:10:48.791Z", "managerId": 1, "updatedAt": "2025-08-25T09:10:48.791Z", "orderNumber": "ORD-2025-001", "totalAmount": "241110.00", "customSource": null, "customerName": "ООО Русагролинии", "deliveryDate": "2025-08-26T21:00:00.000Z", "contractNumber": null, "customerContact": null}	\N	1	2025-09-22 09:19:02.274833
\.


--
-- Data for Name: bottom_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bottom_types (id, code, name, description, is_system, created_at) FROM stdin;
1	spike_0	Шип-0	Низ ковра - Шип-0 (без шипов)	t	2025-08-20 08:01:40.062882
2	spike_2	Шип-2	2 шипа	t	2025-08-20 08:01:40.062882
3	spike_5	Шип-5	5 шипов	t	2025-08-20 08:01:40.062882
4	spike_7	Шип-7	7 шипов	t	2025-08-20 08:01:40.062882
5	spike_11	Шип-11	11 шипов	t	2025-08-20 08:01:40.062882
6	not_selected	Не выбрано	Низ ковра не выбран	t	2025-09-02 18:57:12.633817
\.


--
-- Data for Name: carpet_edge_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carpet_edge_types (id, name, code, description, is_system, created_at) FROM stdin;
1	Прямой рез	direct_cut	Обычный прямой край ковра	f	2025-08-20 08:01:40.062882
2	Паззл	puzzle	Паззловый край ковра с дополнительными опциями	f	2025-08-20 08:01:40.062882
3	Подпазл	sub_puzzle	Тип края ковра - подпазл	f	2025-08-20 11:53:12.464063
4	Литой пазл	cast_puzzle	Тип края ковра - литой пазл	f	2025-08-20 11:53:12.464063
5	Литой	straight_cut	Литой край ковра (по умолчанию)	f	2025-09-02 18:57:12.633817
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, parent_id, path, description, sort_order, created_at, updated_at) FROM stdin;
2	Маты в проходы	\N	Маты в проходы	\N	0	2025-07-22 12:13:06.229	2025-07-22 12:13:06.341
3	Места отдыха животных	\N	Места отдыха животных	\N	0	2025-07-23 12:53:01.938	2025-07-23 12:53:01.945
4	Другое	\N	Другое	\N	0	2025-09-01 09:14:08.553	2025-09-03 12:28:34.31
\.


--
-- Data for Name: cutting_operations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cutting_operations (id, source_product_id, target_product_id, source_quantity, target_quantity, waste_quantity, status, operator_id, assigned_to, planned_date, completed_at, created_at, actual_second_grade_quantity) FROM stdin;
\.


--
-- Data for Name: defect_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defect_products (id, product_id, quantity, defect_type, defect_reason, status, decision, processed_at, created_at) FROM stdin;
\.


--
-- Data for Name: operation_reversals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.operation_reversals (id, audit_log_id, reversal_reason, reversed_by, reversed_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, quantity, reserved_quantity, price, created_at) FROM stdin;
4	2	136	414	281	4617.00	2025-09-22 09:19:39.25773
5	3	136	200	0	4617.00	2025-09-22 09:20:16.260183
\.


--
-- Data for Name: order_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_messages (id, order_id, user_id, message, created_at) FROM stdin;
1	2	1	Заказ был отредактирован	2025-09-22 09:19:39.278546
2	3	1	Заказ был отредактирован	2025-09-22 09:20:16.275241
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, order_number, customer_name, customer_contact, status, priority, delivery_date, manager_id, total_amount, notes, created_at, updated_at, source, custom_source, contract_number) FROM stdin;
2	ORD-2025-002	ООО Русагролинии		ready	normal	2025-09-30 21:00:00	7	1911438.00		2025-09-12 07:40:35.339057	2025-09-22 09:19:39.235	database	\N	414
3	ORD-2025-003	ООО Русагролинии		in_production	normal	2025-10-02 21:00:00	7	923400.00		2025-09-12 07:47:20.402663	2025-09-22 09:20:16.248	database	\N	349
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, name, resource, action, description, created_at) FROM stdin;
1	Просмотр каталога	catalog	view	Просмотр списка товаров и категорий	2025-07-22 06:51:12.527016
2	Создание товаров	catalog	create	Создание новых товаров и категорий	2025-07-22 06:51:12.544079
3	Редактирование товаров	catalog	edit	Изменение товаров и категорий	2025-07-22 06:51:12.562109
4	Удаление товаров	catalog	delete	Удаление товаров и категорий	2025-07-22 06:51:12.56964
5	Просмотр остатков	stock	view	Просмотр остатков на складе	2025-07-22 06:51:12.580355
6	Корректировка остатков	stock	edit	Изменение остатков товаров	2025-07-22 06:51:12.593934
7	Управление остатками	stock	manage	Полное управление остатками	2025-07-22 06:51:12.603338
8	Просмотр заказов	orders	view	Просмотр списка заказов	2025-07-22 06:51:12.608823
9	Создание заказов	orders	create	Создание новых заказов	2025-07-22 06:51:12.61595
10	Редактирование заказов	orders	edit	Изменение заказов	2025-07-22 06:51:12.625717
11	Удаление заказов	orders	delete	Удаление заказов	2025-07-22 06:51:12.633978
12	Просмотр производства	production	view	Просмотр производственных заданий	2025-07-22 06:51:12.639027
13	Создание заданий	production	create	Создание производственных заданий	2025-07-22 06:51:12.647551
14	Управление производством	production	manage	Полное управление производством	2025-07-22 06:51:12.65433
15	Просмотр операций резки	cutting	view	Просмотр операций резки	2025-07-22 06:51:12.660647
16	Создание операций резки	cutting	create	Создание заявок на резку	2025-07-22 06:51:12.665915
17	Выполнение операций резки	cutting	execute	Выполнение операций резки	2025-07-22 06:51:12.67045
18	Просмотр отгрузок	shipments	view	Просмотр отгрузок	2025-07-22 06:51:12.678062
19	Создание отгрузок	shipments	create	Создание отгрузок	2025-07-22 06:51:12.685134
20	Управление отгрузками	shipments	manage	Полное управление отгрузками	2025-07-22 06:51:12.692164
21	Просмотр пользователей	users	view	Просмотр списка пользователей	2025-07-22 06:51:12.698445
22	Управление пользователями	users	manage	Создание и редактирование пользователей	2025-07-22 06:51:12.709229
23	Управление разрешениями	permissions	manage	Управление системой разрешений	2025-07-22 06:51:12.713954
24	Просмотр аудита	audit	view	Просмотр истории изменений	2025-07-22 06:51:12.719154
361	Экспорт каталога	catalog	export	Экспорт товаров и остатков в Excel/CSV/PDF	2025-08-01 13:32:57.767258
362	Экспорт заказов	orders	export	Экспорт заказов в Excel/CSV/PDF	2025-08-01 13:32:57.77215
363	Экспорт производства	production	export	Экспорт производственных заданий в Excel/CSV/PDF	2025-08-01 13:32:57.776173
364	Экспорт операций резки	cutting	export	Экспорт операций резки в Excel/CSV/PDF	2025-08-01 13:32:57.780434
365	Экспорт отгрузок	shipments	export	Экспорт отгрузок в Excel/CSV/PDF	2025-08-01 13:32:57.784577
1213	Управление заказами	orders	manage	Полное управление заказами	2025-09-16 20:22:14.425247
1216	Редактирование производства	production	edit	Редактирование производственных заданий	2025-09-16 20:22:14.435028
1220	Редактирование операций резки	cutting	edit	Редактирование операций резки	2025-09-16 20:22:14.466562
1222	Управление операциями резки	cutting	manage	Полное управление операциями резки	2025-09-16 20:22:14.475762
1225	Редактирование отгрузок	shipments	edit	Редактирование отгрузок	2025-09-16 20:22:14.487801
\.


--
-- Data for Name: product_logos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_logos (id, name, description, is_system, created_at) FROM stdin;
4	GEA	Логотип бренда GEA	t	2025-07-22 12:29:00.222976
5	Maximilk	Логотип бренда Maximilk	t	2025-07-22 12:29:00.222976
6	VELES	Логотип бренда VELES	t	2025-07-22 12:29:00.222976
7	Агротек	Логотип бренда Агротек	t	2025-07-22 12:29:00.222976
8	Арнтьен	Логотип бренда Арнтьен	t	2025-07-22 12:29:00.222976
\.


--
-- Data for Name: product_materials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_materials (id, name, description, is_system, created_at) FROM stdin;
1	Протектор	Материал протектор для резиновых изделий	t	2025-07-22 06:51:12.315827
2	Дробленка	Материал дробленка для резиновых изделий	t	2025-07-22 06:51:12.315827
\.


--
-- Data for Name: product_relations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_relations (id, product_id, related_product_id, relation_type, created_at) FROM stdin;
\.


--
-- Data for Name: product_surfaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_surfaces (id, name, description, is_system, created_at) FROM stdin;
6	Черточки	Поверхность с рисунком в виде черточек	t	2025-07-22 12:29:00.222976
7	Чешуйки	Поверхность с рисунком в виде чешуек	t	2025-07-22 12:29:00.222976
8	Гладкая	Гладкая поверхность без рисунка	t	2025-07-22 12:29:00.222976
9	1 коровка	Поверхность с одним логотипом коровки	t	2025-07-22 12:29:00.222976
10	3 коровки	Поверхность с тремя логотипами коровок	t	2025-07-22 12:29:00.222976
11	Чешуйка с лого	Поверхность с чешуйками и логотипом	t	2025-07-22 12:29:00.222976
\.


--
-- Data for Name: production_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_queue (id, order_id, product_id, quantity, priority, estimated_start_date, estimated_completion_date, actual_start_date, actual_completion_date, status, notes, created_at) FROM stdin;
\.


--
-- Data for Name: production_task_extras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_task_extras (id, task_id, product_id, quantity, notes, created_at) FROM stdin;
\.


--
-- Data for Name: production_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_tasks (id, order_id, product_id, requested_quantity, status, priority, sort_order, created_at, started_at, completed_at, produced_quantity, quality_quantity, defect_quantity, created_by, assigned_to, started_by, completed_by, notes, updated_at, planned_date, planned_start_time, estimated_duration, cancelled_by, cancel_reason) FROM stdin;
1	2	136	133	pending	3	0	2025-09-12 07:40:35.441381	\N	\N	0	0	0	1	\N	\N	\N	Автоматически создано для заказа ORD-2025-002. Дефицит: 133 шт.	2025-09-12 07:40:35.441381	\N	\N	\N	\N	\N
2	\N	171	211	pending	3	0	2025-09-22 10:14:55.814949	\N	\N	0	0	0	1	1	\N	\N	Производственное задание на будущее	2025-09-22 10:14:55.814949	\N	\N	\N	\N	\N
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, article, category_id, manager_id, surface_id, logo_id, material_id, dimensions, characteristics, tags, price, cost_price, norm_stock, notes, photos, is_active, created_at, updated_at, weight, puzzle_options, mat_area, border_type, carpet_edge_sides, carpet_edge_strength, bottom_type_id, puzzle_type_id, puzzle_sides, grade, carpet_edge_type, product_type, pur_number, surface_ids, press_type) FROM stdin;
43	ЛЕЖ	ЛЕЖ-1800x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:29:59.943915	2025-09-02 19:27:06.712372	\N	\N	2.172	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
45	ЛЕЖ	ЛЕЖ-2050x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:35:45.956089	2025-09-02 19:27:06.712372	\N	\N	2.4926	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
44	ЛЕЖ	ЛЕЖ-1850x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1850, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:34:05.031795	2025-09-02 19:27:06.712372	\N	\N	2.2627	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
46	ЛЕЖ	ЛЕЖ-2030x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 2030, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:37:03.910098	2025-09-02 19:27:06.712372	\N	\N	2.4563	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
18	мат	МАТ-2000x1190x24-ЧЕШУЙ-ШИП5-усил-4ст ст п-1СОРТ	2	\N	7	\N	\N	{"width": 1190, "length": 2000, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:14:25.985304	2025-08-21 11:17:14.19	\N	\N	2.38	\N	4	normal	3	1	4	usual	puzzle	carpet	\N	{7}	not_selected
20	мат	МАТ-2000x1030x24-ЧЕРТ-ШИП5-3ст стар п-1СОРТ	2	\N	6	\N	\N	{"width": 1030, "length": 2000, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:22:14.698543	2025-08-21 11:23:17.589	\N	\N	2.06	\N	1	normal	3	1	1	usual	puzzle	carpet	\N	{6}	not_selected
22	мат	МАТ-1930x1190x24-ЧЕШУЙ-ШИП5-усил-2ст стар п-1СОРТ	2	\N	7	\N	\N	{"width": 1190, "length": 1930, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:29:02.633282	2025-08-21 11:29:02.633282	\N	\N	2.2967	\N	2	reinforced	3	1	2	usual	puzzle	carpet	\N	{7}	not_selected
23	мат	МАТ-1500x1150x24-ЧЕШУЙ-ШИП5-усил-2ст стар п-1СОРТ	2	\N	7	\N	\N	{"width": 1150, "length": 1500, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:34:31.020264	2025-08-21 11:34:31.020264	\N	\N	1.725	\N	2	reinforced	3	1	2	usual	puzzle	carpet	\N	{7}	not_selected
24	мат	МАТ-1960x1190x24-ЧЕРТ-ШИП5-2ст стар п-1СОРТ	2	\N	6	\N	\N	{"width": 1190, "length": 1960, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:46:22.031417	2025-08-21 11:46:22.031417	\N	\N	2.3324	\N	2	normal	3	1	2	usual	puzzle	carpet	\N	{6}	not_selected
25	мат	МАТ-1750x1150x24-ЧЕРТ-ШИП5-4ст стар п-1СОРТ	2	\N	6	\N	\N	{"width": 1150, "length": 1750, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:48:02.383409	2025-08-21 11:48:02.383409	\N	\N	2.0125	\N	4	normal	3	1	4	usual	puzzle	carpet	\N	{6}	not_selected
26	ЛЕЖ	ЛЕЖ-1800x1170x30-ЧЕШУЙ-ШИП11-2ст стар п-2СОРТ	3	\N	7	\N	\N	{"width": 1170, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:57:05.664819	2025-08-21 11:59:13.837	\N	\N	2.106	\N	2	reinforced	5	1	2	usual	puzzle	carpet	\N	{7}	not_selected
53	ЛЕЖ	ЛЕЖ-1600x800x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 800, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:13:53.993596	2025-09-02 19:27:06.712372	\N	\N	1.3041	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
56	ЛЕЖ	ЛЕЖ-1930x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1930, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:27:41.882252	2025-09-02 19:27:06.712372	\N	\N	2.3353	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
62	ЛЕЖ	ЛЕЖ-1600x800x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 800, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:48:18.454223	2025-09-02 19:27:06.712372	\N	\N	1.28	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
59	ЛЕЖ	ЛЕЖ-1600x780x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 780, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:33:42.083579	2025-09-02 19:27:06.712372	\N	\N	1.248	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
58	ЛЕЖ	ЛЕЖ-1600x980x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 980, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:32:07.985635	2025-09-02 19:27:06.712372	\N	\N	1.568	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
57	ЛЕЖ	ЛЕЖ-1600x880x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 880, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:29:09.20923	2025-09-02 19:27:06.712372	\N	\N	1.408	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
52	ЛЕЖ	ЛЕЖ-1600x1000x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1000, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:12:23.72199	2025-09-02 19:27:06.712372	\N	\N	1.6261	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
133	ЛЕЖАК	Лежак - 1800x1200x35 - Чеш - КитПресс	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	Бывшая 40ка	\N	t	2025-09-03 11:49:47.407278	2025-09-03 11:49:47.407278	\N	\N	2.16	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{7}	chinese
141	ЛЕЖАК	Лежак - 1800x1200x30 - ЧешЛого - GEA	3	\N	\N	4	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 12:10:37.586925	2025-09-03 12:10:37.586925	\N	\N	2.16	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{11}	not_selected
148	Обод тачки	Обод тачки	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	с 16.08-02.09	\N	t	2025-09-04 08:48:07.896168	2025-09-04 08:48:07.896168	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
156	Скребок мал. с мет.	Скребок мал. с мет.	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	t	2025-09-04 09:38:57.764898	2025-09-04 09:38:57.764898	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
163	мат	Мат - 1200x600x21 - Чеш - 0Шип - ПрямРез4ст - Дроб	2	\N	\N	\N	2	{"width": 600, "length": 1200, "thickness": 21}	\N	\N	\N	\N	0	Стояли в браке 05.09.25	\N	t	2025-09-05 12:25:21.685158	2025-09-05 12:25:21.685158	\N	\N	0.72	without_border	4	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
170	мат	Мат - 2030x1190x24 - Чеш - 5Шип - Пазл4стНов -усил	2	\N	\N	\N	\N	{"width": 1190, "length": 2030, "thickness": 24}	\N	\N	\N	\N	0	резка 16.08-01.09	\N	t	2025-09-08 18:22:44.100884	2025-09-08 18:23:25.4	\N	\N	2.4157	without_border	4	normal	\N	3	4	usual	puzzle	carpet	\N	{7}	not_selected
177	мат	Мат - 1530x1155x24 - Чеш - 5Шип - Пазл2стСтар	2	\N	\N	\N	\N	{"width": 1155, "length": 1530, "thickness": 24}	\N	\N	\N	\N	0	резка 26-29.08	\N	t	2025-09-09 06:18:39.778095	2025-09-09 06:18:39.778095	\N	\N	1.7671	without_border	2	normal	3	1	2	usual	puzzle	carpet	\N	{7}	not_selected
183	мат	Мат - 1279x700x10 - Чеш - 0Шип - Пазл4стСтар	2	\N	\N	\N	\N	{"width": 700, "length": 1279, "thickness": 10}	\N	\N	\N	\N	0	резка 03.09.25	\N	t	2025-09-09 06:55:37.750453	2025-09-09 06:55:37.750453	\N	\N	0.8953	without_border	4	normal	1	1	4	usual	puzzle	carpet	\N	{7}	not_selected
124	ПУР9	ПУР9	4	\N	\N	\N	\N	{"width": 9, "length": 9, "thickness": 9}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:46:33.876992	2025-09-02 07:46:33.876992	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pur	9	\N	\N
116	Тест	Тест-1	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	f	2025-09-01 09:14:59.453736	2025-09-01 09:15:17.552	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
7	Тест grade_2	\N	2	\N	\N	\N	\N	{"width": 100, "length": 100, "thickness": 10}	\N	\N	\N	\N	0	\N	\N	f	2025-08-21 06:35:57.762535	2025-09-02 19:09:20.182494	\N	\N	\N	\N	1	normal	3	\N	\N	grade_2	direct_cut	carpet	\N	\N	not_selected
61	ЛЕЖ	ЛЕЖ-2000x1190x24-ЧЕШУЙ-ШИП7-4ст стар п-1СОРТ	3	\N	7	\N	\N	{"width": 1190, "length": 2000, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:46:20.881572	2025-09-02 19:27:06.712372	\N	\N	2.38	without_border	4	normal	6	1	4	usual	puzzle	carpet	\N	{7}	not_selected
126	ЛЕЖАК	Лежак - 1800x1175x30 - 3Кор	3	\N	\N	\N	\N	{"width": 1175, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 11:28:18.274076	2025-09-03 11:28:18.274076	\N	\N	2.115	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{10}	not_selected
134	ЛЕЖАК	Лежак - 1800x1200x35 - Чеш - НеУсил,УкрПресс	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	50 у Вити	\N	t	2025-09-03 11:52:43.708183	2025-09-03 11:52:43.708183	\N	\N	2.16	without_border	1	weak	\N	\N	1	usual	straight_cut	carpet	\N	{7}	ukrainian
142	ЛЕЖАК	Лежак - 1800x1200x35 - ЧешЛого - Агр - СБорт	3	\N	\N	7	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 12:12:12.968797	2025-09-03 12:12:12.968797	\N	\N	2.16	with_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{11}	not_selected
149	Грудной упор 	Грудной упор 	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	Остатки периода до 15.08.25	\N	t	2025-09-04 09:25:54.879865	2025-09-04 09:25:54.879865	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
157	Техплита 1320х730	Техплита 1320х730	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	t	2025-09-04 09:39:52.100869	2025-09-04 09:39:52.100869	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
164	ЛЕЖ	Леж - 2050x1200x30 - Чеш - 11Шип	3	\N	\N	\N	\N	{"width": 1200, "length": 2050, "thickness": 30}	\N	\N	\N	\N	0	изготовлены  05.09.25	\N	t	2025-09-08 12:15:56.159418	2025-09-08 12:15:56.159418	\N	\N	2.46	without_border	1	normal	5	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
171	ЛЕЖ	Леж - 1900x1200x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 1200, "length": 1900, "thickness": 24}	\N	\N	\N	\N	0	из резки17-18.09	\N	t	2025-09-08 18:40:02.784482	2025-09-08 18:40:02.784482	\N	\N	2.28	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
178	ЛЕЖ	Леж - 2000x1200x30 - Черт - 11Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1200, "length": 2000, "thickness": 30}	\N	\N	\N	\N	0	резка 27-30.08	\N	t	2025-09-09 06:21:24.276064	2025-09-09 06:21:24.276064	\N	\N	2.4	without_border	4	normal	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
184	ЛЕЖ	Леж - 1700x1000x24 - Чеш - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1000, "length": 1700, "thickness": 24}	\N	\N	\N	\N	0	резка 04-06.09.25	\N	t	2025-09-09 06:58:32.946743	2025-09-09 06:58:32.946743	\N	\N	1.7	without_border	4	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
189	ЛЕЖ	Леж - 1800x1200x24 - Чеш - Шип7 - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-11 13:05:09.647353	2025-09-11 13:05:09.647353	\N	\N	2.16	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
194	Рулонное покр	Рул покр - 29600x1800x30 - 3Кор - 25Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 29600, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор	\N	t	2025-09-11 16:46:20.203543	2025-09-11 16:58:19.004	\N	\N	45	without_border	1	normal	\N	\N	\N	usual	straight_cut	roll_covering	\N	{10}	not_selected
198	Рулонное покр	Покрытие - 27378x1800x30 - 3Кор - 23.5Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 27378, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор  Либерти	\N	t	2025-09-11 17:11:13.22138	2025-09-11 17:11:13.22138	\N	\N	49.2804	\N	\N	\N	\N	\N	\N	\N	\N	roll_covering	\N	{10}	not_selected
206	Рулонное покр	Покрытие - 18522x1000x21 - Черт - Шип0 - 15.5Ковр	3	\N	\N	\N	\N	{"width": 1000, "length": 18522, "thickness": 21}	\N	\N	\N	\N	0	1000х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:09:10.35695	2025-09-11 18:10:14.617	\N	\N	18.522	without_border	1	normal	1	\N	\N	usual	straight_cut	roll_covering	\N	{6}	not_selected
210	Рулонное покр	Покрытие - 19120x1900x21 - Черт - Шип0 - 16Ковр	3	\N	\N	\N	\N	{"width": 1900, "length": 19120, "thickness": 21}	\N	\N	\N	\N	0	1900х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:22:40.610692	2025-09-11 18:22:40.610692	\N	\N	36.328	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
55	мат	МАТ-2030x1190x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1190, "length": 2030, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	f	2025-08-22 07:17:31.871379	2025-08-27 13:12:47.771	\N	\N	2.4157	\N	4	normal	4	3	4	usual	puzzle	carpet	\N	{7}	not_selected
202	Рулонное покр	Покрытие - 25095x1950x21 - Черт-Шип0- 21Ковр	3	\N	\N	\N	\N	{"width": 1950, "length": 25095, "thickness": 21}	\N	\N	\N	\N	0	1950х1195х21 Чёрт Ш0	\N	t	2025-09-11 17:40:07.536927	2025-09-11 18:27:54.499	\N	\N	48.9353	without_border	1	normal	1	\N	\N	usual	straight_cut	roll_covering	\N	{6}	not_selected
214	Рулонное покр	Покрытие - 5975x2000x21 - Черт - Шип0 - 5Ковр	3	\N	\N	\N	\N	{"width": 2000, "length": 5975, "thickness": 21}	\N	\N	\N	\N	0	2000х11195х21 Чёрт Ш0	\N	t	2025-09-11 18:39:35.13132	2025-09-11 18:39:35.13132	\N	\N	11.95	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
218	Рулонное покр	Покрытие - 14600x2000x21 - Черт - Шип0 - 7.3Ковр	3	\N	\N	\N	\N	{"width": 2000, "length": 14600, "thickness": 21}	\N	\N	\N	\N	0	1195х2000х21 Чёрт Ш0	\N	t	2025-09-11 18:59:45.852303	2025-09-11 18:59:45.852303	\N	\N	29.2	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
33	ЛЕЖ	ЛЕЖ-1800x1190x30-ЧЕШУЙ-ШИП11-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 1190, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:29:26.175059	2025-09-02 19:09:20.182494	\N	\N	2.142	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
127	ЛЕЖАК	Лежак - 1800x1165x30 - 3Кор	3	\N	\N	\N	\N	{"width": 1165, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	33 - на отгрузке, 27 - возле цеха	\N	t	2025-09-03 11:31:30.276562	2025-09-03 11:31:30.276562	\N	\N	2.097	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{10}	not_selected
135	ЛЕЖАК	Лежак - 1800x1200x35 - Чеш - НеУсил,УкрПресс - Либер	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	У Вити 56+36	\N	t	2025-09-03 11:55:56.24886	2025-09-03 11:56:47.177	\N	\N	2.16	without_border	1	weak	\N	\N	1	liber	straight_cut	carpet	\N	{7}	ukrainian
70	мат	МАТ-2000x1190x21-ЧЕШУЙ-ШИП2-4ст нов п-1СОРТ	2	\N	7	\N	\N	{"width": 1190, "length": 2000, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 08:47:50.317082	2025-08-22 08:47:50.317082	\N	\N	2.38	\N	4	normal	2	3	4	usual	puzzle	carpet	\N	{7}	not_selected
143	ВЕРБ	Верб - 1830x1200x30 - Чеш	3	\N	\N	\N	\N	{"width": 1200, "length": 1830, "thickness": 30}	\N	\N	\N	\N	0	с 16.08-02.09	\N	t	2025-09-04 08:05:01.840403	2025-09-04 08:06:50.212	\N	\N	2.196	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
150	Коврик кольц 600х400 	Коврик кольц 600х400 	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	Остатки до 15.08.25	\N	t	2025-09-04 09:29:15.615748	2025-09-04 09:29:15.615748	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
158	Квадраты СТАР (разные)	Квадраты СТАР (разные)	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	t	2025-09-04 09:43:49.590551	2025-09-04 09:43:49.590551	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
165	ЛЕЖ	Леж - 1800x1200x24 - Чеш - 7Шип - 2С	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-08 12:30:58.413488	2025-09-08 12:30:58.413488	\N	\N	2.16	without_border	1	normal	4	\N	1	grade_2	straight_cut	carpet	\N	{7}	not_selected
78	мат	МАТ-1300x715x10-ЧЕШУЙ-ШИП0-4ст нов п-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 10}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 11:21:38.318205	2025-08-22 11:21:38.318205	\N	\N	0.9295	\N	4	normal	1	3	4	usual	puzzle	carpet	\N	{7}	not_selected
172	ЛЕЖ	Леж - 1800x1180x24 - Чеш - 7Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1180, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-08 18:43:08.946582	2025-09-08 18:45:11.352	\N	\N	2.124	without_border	4	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
80	мат	МАТ-1300x715x24-ЧЕРТ-ШИП5-4ст стар п-1СОРТ	2	\N	6	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 11:27:36.096343	2025-08-22 11:27:36.096343	\N	\N	0.9295	\N	4	normal	3	1	4	usual	puzzle	carpet	\N	{6}	not_selected
81	мат	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-4ст стар п-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 11:30:22.954287	2025-08-22 11:30:22.954287	\N	\N	0.9295	\N	4	normal	3	1	4	usual	puzzle	carpet	\N	{7}	not_selected
179	ЛЕЖ	Леж - 1900x1200x30 - Черт - 11Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1200, "length": 1900, "thickness": 30}	\N	\N	\N	\N	0	резка 30.08.25	\N	t	2025-09-09 06:27:28.756569	2025-09-09 06:27:28.756569	\N	\N	2.28	without_border	4	normal	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
185	ЛЕЖ	Леж - 1800x1080x24 - Чеш - Шип7 - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1080, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-09 12:02:42.137759	2025-09-11 07:46:32.117	\N	\N	1.944	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
190	ЛЕЖ	Леж - 1860x1200x24 - Чеш - Шип7 - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1200, "length": 1860, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-11 13:07:06.799903	2025-09-11 13:07:06.799903	\N	\N	2.232	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
195	Рулонное покр	Покрытие - 30290x1800x30 - 3Кор - 26Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 30290, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор 	\N	t	2025-09-11 16:57:30.459915	2025-09-11 16:57:30.459915	\N	\N	54.522	\N	\N	\N	\N	\N	\N	\N	\N	roll_covering	\N	{10}	not_selected
199	Рулонное покр	Покрытие - 34950x1800x30 - 3Кор - 30Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 34950, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор Либерти	\N	t	2025-09-11 17:23:56.475259	2025-09-11 17:23:56.475259	\N	\N	62.91	\N	\N	\N	\N	\N	\N	\N	\N	roll_covering	\N	{10}	not_selected
203	Рулонное покр	Покрытие - 8963x1950x21 - Черт - Шип0 - 7.5Ковр	3	\N	\N	\N	\N	{"width": 1950, "length": 8963, "thickness": 21}	\N	\N	\N	\N	0	1950х1195х21 ЧЁрт Ш0	\N	t	2025-09-11 17:43:29.437017	2025-09-11 17:43:29.437017	\N	\N	17.4779	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
207	Рулонное покр	Покрытие - 13145x1000x21 - Черт - Шип0 - 11Ковр	3	\N	\N	\N	\N	{"width": 1000, "length": 13145, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-09-11 18:12:56.216493	2025-09-11 18:12:56.216493	\N	\N	13.145	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
211	Рулонное покр	Покрытие - 8962x1900x21 - Черт - Шип0 - 7.5Ковр	3	\N	\N	\N	\N	{"width": 1900, "length": 8962, "thickness": 21}	\N	\N	\N	\N	0	1900х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:30:25.880306	2025-09-11 18:30:25.880306	\N	\N	17.0278	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
215	Рулонное покр	Покрытие - 18522x2000x21 - Черт - Шип0 - 15.5Ковр	3	\N	\N	\N	\N	{"width": 2000, "length": 18522, "thickness": 21}	\N	\N	\N	\N	0	2000х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:42:30.494395	2025-09-11 18:42:30.494395	\N	\N	37.044	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
219	Рулонное покр	Покрытие - 16000x597x21 - Черт - Шип0 - 8Ковр	3	\N	\N	\N	\N	{"width": 597, "length": 16000, "thickness": 21}	\N	\N	\N	\N	0	597х2000х21 Чёрт Ш0	\N	t	2025-09-11 19:03:50.398192	2025-09-11 19:03:50.398192	\N	\N	9.552	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
117	ПУР5	ПУР 5	4	\N	\N	\N	\N	{"width": 0, "length": 0, "thickness": 0}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 06:59:41.31859	2025-09-02 19:09:20.182494	\N	\N	\N	without_border	1	normal	\N	\N	\N	usual	direct_cut	other	\N	{}	not_selected
125	мат	Мат - 1300x715x24 - 5Шип - Пазл4стСтар п/с	2	\N	\N	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 08:04:48.130303	2025-09-02 19:27:06.712372	\N	\N	0.9295	without_border	4	normal	6	1	4	usual	puzzle	carpet	\N	{}	not_selected
128	ЛЕЖАК	Лежак - 1800x1185x30 - 3Кор - СБорт	3	\N	\N	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	36 - у Вити	\N	t	2025-09-03 11:33:50.787004	2025-09-03 11:33:50.787004	\N	\N	2.133	with_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{10}	not_selected
136	ЛЕЖАК	Лежак - 1800x1200x30 - Чеш - НеУсил,КитПресс	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 11:58:48.028801	2025-09-03 11:58:48.028801	\N	\N	2.16	without_border	1	weak	\N	\N	1	usual	straight_cut	carpet	\N	{7}	chinese
144	ЛЕЖ	Леж - 1600x900x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 900, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	с 16.08-02.09	\N	t	2025-09-04 08:25:24.585404	2025-09-04 08:25:24.585404	\N	\N	1.44	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
151	Коврик кольц 600х400 отверстие	Коврик кольц 600х400 отверстие	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	остатки до 15.08.25	\N	t	2025-09-04 09:30:53.162385	2025-09-04 09:30:53.162385	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
166	ЛЕЖ	Леж - 2050x1200x24 - Чеш - 7Шип - 2С	3	\N	\N	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-08 17:04:43.427493	2025-09-08 17:04:43.427493	\N	\N	2.46	without_border	1	normal	4	\N	1	grade_2	straight_cut	carpet	\N	{7}	not_selected
173	ВЕРБ	Верб - 1800x1100x30 - Чеш - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1100, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	Резка 20-31.08	\N	t	2025-09-09 06:05:35.000116	2025-09-09 06:05:35.000116	\N	\N	1.98	without_border	4	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
180	ЛЕЖ	Леж - 1860x1190x24 - Чеш - 7Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1190, "length": 1860, "thickness": 24}	\N	\N	\N	\N	0	резка 02-03.09.25	\N	t	2025-09-09 06:41:33.637414	2025-09-09 06:41:33.637414	\N	\N	2.2134	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
186	ЛЕЖ	Леж - 2000x1190x24 - Чеш - Шип7 - Пазл1стСтар	3	\N	\N	\N	\N	{"width": 1190, "length": 2000, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-09 13:56:23.395453	2025-09-11 07:45:45.035	\N	\N	2.38	without_border	1	normal	4	1	1	usual	puzzle	carpet	\N	{7}	not_selected
159	Рулонное покр	Рул Покр - 25000x1000x21 - Черт - 0Шип - 21Ковр	2	\N	\N	\N	\N	{"width": 1000, "length": 25000, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	f	2025-09-04 11:31:43.133104	2025-09-11 10:49:14.617	\N	\N	25	without_border	1	normal	1	\N	\N	usual	straight_cut	roll_covering	\N	{6}	chinese
191	Рулонное покр	Рулон покр - 29600x1800x35 - Чеш - 25Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 29600, "thickness": 35}	\N	\N	\N	\N	0	1800х1185х35 Чеуйка	\N	t	2025-09-11 13:19:56.184091	2025-09-11 13:25:27.44	\N	\N	35.076	without_border	1	normal	\N	\N	\N	usual	straight_cut	roll_covering	\N	{7}	not_selected
196	Рулонное покр	Покрытие - 32620x1800x30 - 3Кор - 28Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 32620, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор для Либерти	\N	t	2025-09-11 17:02:19.763724	2025-09-11 17:02:19.763724	\N	\N	58.716	\N	\N	\N	\N	\N	\N	\N	\N	roll_covering	\N	{10}	not_selected
200	Рулонное покр	Покрытие - 38445x1800x30 - 3Кор - 33Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 38445, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор Либерти	\N	t	2025-09-11 17:28:14.055085	2025-09-11 17:28:14.055085	\N	\N	69.201	\N	\N	\N	\N	\N	\N	\N	\N	roll_covering	\N	{10}	not_selected
204	Рулонное покр	Покрытие - 20912x1950x21 - Черт - Шип0 - 17.5Ковр	3	\N	\N	\N	\N	{"width": 1950, "length": 20912, "thickness": 21}	\N	\N	\N	\N	0	1950х1195х21 Чёрт Ш0	\N	t	2025-09-11 17:59:11.199721	2025-09-11 17:59:11.199721	\N	\N	40.7784	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
208	Рулонное покр	Покрытие - 22944x1900x21 - Черт - Шип0 - 19.2Ковр	3	\N	\N	\N	\N	{"width": 1900, "length": 22944, "thickness": 21}	\N	\N	\N	\N	0	1900х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:15:13.75864	2025-09-11 18:15:13.75864	\N	\N	43.5936	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
212	Рулонное покр	Покрытие - 23300x1800x21 - Черт - Шип0 - 19.5Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 23300, "thickness": 21}	\N	\N	\N	\N	0	1800х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:34:28.865705	2025-09-11 18:34:28.865705	\N	\N	41.94	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
216	Рулонное покр	Покрытие - 19120x1600x21 - Черт - Шип0 - 16Ковр	3	\N	\N	\N	\N	{"width": 1600, "length": 19120, "thickness": 21}	\N	\N	\N	\N	0	1600х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:48:08.53398	2025-09-11 18:48:08.53398	\N	\N	30.592	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
220	мат	Мат - 1290x710x24 - Чеш - Шип5 - Пазл4стСтарый 04.2025	2	\N	\N	\N	\N	{"width": 710, "length": 1290, "thickness": 24}	\N	\N	\N	\N	0	резка 10.09.	\N	t	2025-09-12 13:10:06.479527	2025-09-12 13:10:06.479527	\N	\N	0.9159	without_border	4	normal	3	2	4	usual	puzzle	carpet	\N	{7}	not_selected
1	мат	МАТ-1750x1200x24-ЧЕШУЙ-GEA-ШИП5-4ст нов лит п-усил-1СОРТ	2	\N	11	4	\N	{"width": 1200, "length": 1750, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-20 11:09:40.599727	2025-09-02 19:09:20.182494	\N	\N	2.1	\N	4	normal	3	3	4	usual	direct_cut	carpet	\N	{11}	not_selected
3	мат	МАТ-1720x1160x24-ЧЕШУЙ-GEA-ШИП5-4ст стар п-1СОРТ	2	\N	11	4	\N	{"width": 1160, "length": 1720, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-20 11:20:21.774894	2025-09-02 19:09:20.182494	\N	\N	1.9952	\N	4	normal	3	1	4	usual	direct_cut	carpet	\N	{11}	not_selected
118	ПУР6	ПУР6	4	\N	\N	\N	\N	{"width": 1, "length": 1, "thickness": 1}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:02:55.255676	2025-09-02 19:09:20.182494	\N	\N	\N	without_border	1	normal	\N	\N	\N	usual	direct_cut	pur	6	{}	not_selected
48	ЛЕЖ	ЛЕЖ-1950x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	3	\N	11	6	\N	{"width": 1200, "length": 1950, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:39:48.020712	2025-09-02 19:27:06.712372	\N	\N	2.3837	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
107	ЛЕЖАК	ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-1СОРТ	3	\N	10	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:53:14.179127	2025-09-03 11:20:31.147	\N	\N	2.133	with_border	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
108	ЛЕЖАК	ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-не ус-1СОРТ	3	\N	10	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:55:25.825604	2025-09-03 11:20:38.403	\N	\N	2.133	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
109	ЛЕЖАК	ЛЕЖАК-1800x1200x40-1КОР-СБОРТ-не ус-1СОРТ	3	\N	9	\N	\N	{"width": 1200, "length": 1800, "thickness": 40}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:04:15.564376	2025-09-03 11:20:43.712	\N	\N	2.16	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{9}	not_selected
110	ЛЕЖАК	ЛЕЖАК-1800x1200x35-1КОР-СБОРТ-не ус-1СОРТ	3	\N	9	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:08:26.06843	2025-09-03 11:20:50.024	\N	\N	2.16	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{9}	not_selected
119	ПУР7	ПУР 7	4	\N	\N	\N	\N	{"width": 1, "length": 1, "thickness": 1}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:04:22.725627	2025-09-02 19:09:20.182494	\N	\N	\N	without_border	1	normal	\N	\N	\N	usual	direct_cut	pur	7	{}	not_selected
95	ВЕРБ	ВЕРБ-1830x1200x30-ЧЕРТ-Прям рез-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1830, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:22:02.558725	2025-09-02 19:09:20.182494	\N	\N	2.196	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
94	ВЕРБ	ВЕРБ-1950x1000x30-ЧЕРТ-1СОРТ	3	\N	6	\N	\N	{"width": 1000, "length": 1950, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:19:28.924949	2025-09-02 19:09:20.182494	\N	\N	1.9695	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
82	ВЕРБ	ВЕРБ-2030x1200x30-ЧЕРТ-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 2030, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:00:29.793292	2025-09-02 19:09:20.182494	\N	\N	2.4563	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
39	ЛЕЖ	ЛЕЖ-2030x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 2030, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:38:51.751346	2025-09-02 19:09:20.182494	\N	\N	2.4563	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
63	мат	МАТ-2050x1200x21-ЧЕШУЙ-GEA-ШИП0-Подпазл-1СОРТ	2	\N	11	4	\N	{"width": 1200, "length": 2050, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:55:51.151004	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	normal	1	\N	1	usual	sub_puzzle	carpet	\N	{11}	not_selected
11	мат	МАТ-2050x1200x24-ЧЕШУЙ-ШИП5-Усил-Подпазл-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:30:10.603543	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	reinforced	3	\N	1	usual	sub_puzzle	carpet	\N	{7}	not_selected
75	мат	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-Подпазл-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 10:49:13.915138	2025-09-02 19:09:20.182494	\N	\N	0.9295	\N	1	normal	3	\N	1	usual	sub_puzzle	carpet	\N	{7}	not_selected
19	мат	МАТ-1750x1200x24-ЧЕШУЙ-ШИП5-лит п-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 1750, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:19:22.141491	2025-09-02 19:09:20.182494	\N	\N	2.112	\N	1	normal	3	\N	1	usual	cast_puzzle	carpet	\N	{7}	not_selected
9	мат	МАТ-2000x1200x24-ЧЕШУЙ-ШИП5-4ст нов лит п-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2000, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 07:21:45.411841	2025-09-02 19:09:20.182494	\N	\N	2.412	\N	1	normal	3	\N	1	usual	cast_puzzle	carpet	\N	{7}	not_selected
76	мат	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-Литой пазл-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 11:01:13.694089	2025-09-02 19:09:20.182494	\N	\N	0.9295	\N	1	normal	3	\N	1	usual	cast_puzzle	carpet	\N	{7}	not_selected
111	ЛЕЖАК	ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-1СОРТ	3	\N	10	\N	\N	{"width": 1185, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:14:15.630196	2025-09-03 11:20:55.449	\N	\N	2.133	with_border	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
104	ЛЕЖАК	ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-ЛИБЕР	3	\N	10	\N	\N	{"width": 1185, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:47:57.480798	2025-09-03 11:21:04.945	\N	\N	2.133	with_border	1	normal	1	\N	1	grade_2	direct_cut	carpet	\N	{10}	not_selected
97	ЛЕЖАК	ЛЕЖАК-1800x1185x30-ЧЕШУЙ-СБОРТ-не ус-1СОРТ	3	\N	7	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-22 12:35:03.586385	2025-09-03 11:21:16.688	\N	\N	2.133	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
99	ЛЕЖАК	ЛЕЖАК-1800x1195x35-ЧЕШУЙ-не ус-1СОРТ	3	\N	7	\N	\N	{"width": 1195, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	f	2025-08-22 13:02:28.971916	2025-09-03 11:21:21.632	\N	\N	2.151	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
115	ЛЕЖАК	ЛЕЖАК-1800x1175x30-3КОР-БЕЗБОРТ-1СОРТ	3	\N	10	\N	\N	{"width": 1175, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:22:14.394893	2025-09-03 11:21:27.352	\N	\N	2.115	without_border	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
100	ЛЕЖАК	ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:12:30.249559	2025-09-03 11:21:32.934	\N	\N	2.16	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
112	ЛЕЖАК	ЛЕЖАК-1800x1200x30-ЧЕШУЙ-СБОРТ-GEA-1СОРТ	3	\N	11	4	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:17:07.902254	2025-09-03 11:21:59.249	\N	\N	2.16	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
113	ЛЕЖАК	ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-АГРОТ-1СОРТ	3	\N	11	7	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:19:01.815003	2025-09-03 11:22:05.565	\N	\N	2.16	with_border	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
114	ЛЕЖАК	ЛЕЖАК-1800x1165x30-3КОР-1СОРТ	3	\N	10	\N	\N	{"width": 1165, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 07:20:44.806095	2025-09-03 11:22:11.536	\N	\N	2.097	\N	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
129	ЛЕЖАК	Лежак - 1800x1185x30 - 3Кор - СБорт,НеУсил	3	\N	\N	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 11:36:06.856736	2025-09-03 11:36:06.856736	\N	\N	2.133	with_border	1	weak	\N	\N	1	usual	straight_cut	carpet	\N	{10}	not_selected
137	ЛЕЖАК	Лежак - 1800x1195x30 - Чеш - ПрямРез2ст - НеУсил	3	\N	\N	\N	\N	{"width": 1195, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	на отгрузке стоят	\N	t	2025-09-03 12:01:14.443876	2025-09-03 12:01:14.443876	\N	\N	2.151	without_border	2	weak	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
120	ПУР8	ПУР 8	4	\N	\N	\N	\N	{"width": 3, "length": 3, "thickness": 3}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:31:07.872391	2025-09-02 07:31:07.872391	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pur	8	\N	\N
42	ЛЕЖ	ЛЕЖ-1800x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	3	\N	11	6	\N	{"width": 1200, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:24:24.688731	2025-09-02 19:27:06.712372	\N	\N	2.172	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
77	мат	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-Литой пазл обрез-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 11:08:59.332159	2025-09-02 19:09:20.182494	\N	\N	0.9295	\N	1	normal	3	\N	1	usual	cast_puzzle	carpet	\N	{7}	not_selected
130	ЛЕЖАК	Лежак - 1800x1200x35 - Чеш - СБорт	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	18 - возле цеха	\N	t	2025-09-03 11:38:39.121459	2025-09-03 11:38:39.121459	\N	\N	2.16	with_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
138	ЛЕЖАК	Лежак - 1800x1195x35 - Чеш - ПрямРез2ст-НеУсил	3	\N	\N	\N	\N	{"width": 1195, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 12:02:54.385786	2025-09-03 12:14:25.303	\N	\N	2.151	without_border	2	weak	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
145	ЛЕЖ	Леж - 1700x1000x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 1000, "length": 1700, "thickness": 24}	\N	\N	\N	\N	0	16.08-02.09	\N	t	2025-09-04 08:31:41.990345	2025-09-04 08:31:41.990345	\N	\N	1.7	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
152	Коврик придверный 600х400 	Коврик придверный 600х400 	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	Остатки до 15.08.25	\N	t	2025-09-04 09:34:05.245522	2025-09-04 09:34:05.245522	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
167	мат	Мат - 2000x1190x24 - Чеш - 5Шип - Пазл4стСтарый 04.2025	2	\N	\N	\N	\N	{"width": 1190, "length": 2000, "thickness": 24}	\N	\N	\N	\N	0	резка с 15.08-05.09	\N	t	2025-09-08 17:44:56.327327	2025-09-08 17:44:56.327327	\N	\N	2.38	without_border	4	normal	3	2	4	usual	puzzle	carpet	\N	{7}	not_selected
174	ЛЕЖ	Леж - 1450x880x24 - Чеш - 7Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 880, "length": 1450, "thickness": 24}	\N	\N	\N	\N	0	резка 23-25.08	\N	t	2025-09-09 06:10:30.107548	2025-09-09 06:10:30.107548	\N	\N	1.276	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
181	ЛЕЖ	Леж - 1900x1200x30 - Черт - 11Шип - Пазл1стСтар	3	\N	\N	\N	\N	{"width": 1200, "length": 1900, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-09-09 06:48:59.841948	2025-09-09 06:48:59.841948	\N	\N	2.28	without_border	1	normal	5	1	1	usual	puzzle	carpet	\N	{6}	not_selected
160	Рулонное покр	Покрытие - 13000x1000x21 - Черт - 0Шип - 11Ковр	2	\N	\N	\N	\N	{"width": 1000, "length": 13000, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	f	2025-09-04 11:34:34.42825	2025-09-11 10:49:10.663	\N	\N	13	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
187	мат	Мат - 1279x700x10 - Чеш - Шип0 - Пазл4стСтар - Прот	2	\N	\N	\N	1	{"width": 700, "length": 1279, "thickness": 10}	\N	\N	\N	\N	0	\N	\N	t	2025-09-11 12:55:06.114468	2025-09-11 12:55:06.114468	\N	\N	0.8953	without_border	4	normal	1	1	4	usual	puzzle	carpet	\N	{7}	not_selected
192	Рулонное покр	Покрытие - 22400x1100x21 - Черт - Шип0 - 12Ковр	3	\N	\N	\N	\N	{"width": 1100, "length": 22400, "thickness": 21}	\N	\N	\N	\N	0	2000х1100х21 Ш0 Чёрт	\N	t	2025-09-11 13:34:18.95114	2025-09-11 13:34:18.95114	\N	\N	24.64	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
197	Рулонное покр	Покрытие - 26212x1800x30 - 3Кор - 22.5Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 26212, "thickness": 30}	\N	\N	\N	\N	0	1800х1165х30 3Кор для Либерти	\N	t	2025-09-11 17:06:22.123825	2025-09-11 17:06:22.123825	\N	\N	47.1816	\N	\N	\N	\N	\N	\N	\N	\N	roll_covering	\N	{10}	not_selected
201	Рулонное покр	Покрытие - 9560x2000x21 - Черт - Шип0 - 8Ковр	3	\N	\N	\N	\N	{"width": 2000, "length": 9560, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-09-11 17:34:56.085753	2025-09-11 17:34:56.085753	\N	\N	19.12	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
205	Рулонное покр	Покрытие - 25095x1000x21 - Черт - Шип0 - 21Ковр	3	\N	\N	\N	\N	{"width": 1000, "length": 25095, "thickness": 21}	\N	\N	\N	\N	0	1000х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:05:37.978745	2025-09-11 18:05:37.978745	\N	\N	25.095	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
209	Рулонное покр	Покрытие - 16132x1900x21 - Черт - Шип0 - 13.5Ковр	3	\N	\N	\N	\N	{"width": 1900, "length": 16132, "thickness": 21}	\N	\N	\N	\N	0	1900х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:19:55.536191	2025-09-11 18:19:55.536191	\N	\N	30.6508	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
213	Рулонное покр	Покрытие - 19120x1800x21 - Черт - Шип0 - 16Ковр	3	\N	\N	\N	\N	{"width": 1800, "length": 19120, "thickness": 21}	\N	\N	\N	\N	0	1800х1195х21 Чёрт Ш0	\N	t	2025-09-11 18:37:10.616177	2025-09-11 18:37:10.616177	\N	\N	34.416	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
217	Рулонное покр	Покрытие - 13000x1195x21 - Черт - Шип0 - 7Ковр	3	\N	\N	\N	\N	{"width": 1195, "length": 13000, "thickness": 21}	\N	\N	\N	\N	0	1195х2000х21 Чёрт Ш0  (длиной 13000мм)	\N	t	2025-09-11 18:56:05.253153	2025-09-12 10:00:14.827	\N	\N	16.73	without_border	1	normal	1	\N	\N	usual	straight_cut	roll_covering	\N	{6}	not_selected
121	ПУР2	ПУР2	4	\N	\N	\N	\N	{"width": 1, "length": 1, "thickness": 1}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:37:06.765015	2025-09-02 07:37:06.765015	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pur	2	\N	\N
8	мат	МАТ-1890x1160x24-ЧЕШУЙ-ШИП5-4ст стар п-2СОРТ	2	\N	7	\N	\N	{"width": 1160, "length": 1890, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 06:46:19.303814	2025-09-02 19:09:20.182494	\N	\N	2.1924	\N	4	normal	3	1	4	usual	direct_cut	carpet	\N	{7}	not_selected
27	ЛЕЖ	ЛЕЖ-1800x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:01:15.01923	2025-09-02 19:09:20.182494	\N	\N	2.16	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
28	ЛЕЖ	ЛЕЖ-1800x1185x30-ЧЕШУЙ-ШИП11-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:04:01.442775	2025-09-02 19:09:20.182494	\N	\N	2.133	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
29	ЛЕЖ	ЛЕЖ-1800x1200x30-ЧЕРТ-ШИП11-2СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:06:31.995197	2025-09-02 19:09:20.182494	\N	\N	2.16	\N	1	reinforced	5	\N	1	grade_2	direct_cut	carpet	\N	{6}	not_selected
30	ЛЕЖ	ЛЕЖ-1800x1200x30-ЧЕРТ-ШИП11-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:24:29.064153	2025-09-02 19:09:20.182494	\N	\N	2.16	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
10	мат	МАТ-2050x1200x24-ЧЕШУЙ-АГРОТ-ШИП5-Подпазл-1СОРТ	2	\N	11	7	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:25:54.975924	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
12	мат	МАТ-2050x1200x24-ЧЕШУЙ-ШИП5-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:32:47.29075	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
13	мат	МАТ-1750x1200x24-ЧЕРТ-ШИП5-1СОРТ	2	\N	6	\N	\N	{"width": 1200, "length": 1750, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:34:23.456202	2025-09-02 19:09:20.182494	\N	\N	2.1538	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
15	мат	МАТ-2050x1200x24-ЧЕРТ-ШИП5-1СОРТ	2	\N	6	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:38:39.583889	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
14	мат	МАТ-1990x1200x24-ЧЕШУЙ-ШИП5-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 1990, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:37:17.112664	2025-09-02 19:09:20.182494	\N	\N	2.4079	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
16	мат	МАТ-1600x900x24-ЧЕШУЙ-ШИП5-1СОРТ	2	\N	7	\N	\N	{"width": 900, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 10:40:33.77827	2025-09-02 19:09:20.182494	\N	\N	1.449	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
17	мат	МАТ-2050x1200x24-ЧЕШУЙ-ШИП5-усил-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:12:14.976236	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	reinforced	3	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
31	ЛЕЖ	ЛЕЖ-1930x1200x30-ЧЕРТ-ШИП11-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1930, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:25:55.041393	2025-09-02 19:09:20.182494	\N	\N	2.316	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
32	ЛЕЖ	ЛЕЖ-1800x1190x30-ЧЕРТ-ШИП11-Прям рез-1СОРТ	3	\N	6	\N	\N	{"width": 1190, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:27:45.870447	2025-09-02 19:09:20.182494	\N	\N	2.142	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
34	ЛЕЖ	ЛЕЖ-1700x1190x30-ЧЕРТ-ШИП11-Прям рез-1СОРТ	3	\N	6	\N	\N	{"width": 1190, "length": 1700, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:31:42.206798	2025-09-02 19:09:20.182494	\N	\N	2.023	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
36	ЛЕЖ	ЛЕЖ-1900x1190x30-ЧЕШУЙ-ШИП11-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 1190, "length": 1900, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:35:04.577343	2025-09-02 19:09:20.182494	\N	\N	2.261	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
37	ЛЕЖ	ЛЕЖ-1930x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1930, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:36:23.069008	2025-09-02 19:09:20.182494	\N	\N	2.316	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
38	ЛЕЖ	ЛЕЖ-1850x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1850, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:37:33.754633	2025-09-02 19:09:20.182494	\N	\N	2.232	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
35	ЛЕЖ	ЛЕЖ-2030x1200x30-ЧЕРТ-ШИП11-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 2030, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 12:33:33.755585	2025-09-02 19:09:20.182494	\N	\N	2.4563	\N	1	reinforced	5	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
21	мат	МАТ-1750x1200x24-ЧЕШУЙ-ШИП5-усил-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 1750, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 11:25:53.624947	2025-09-02 19:09:20.182494	\N	\N	2.0825	\N	1	reinforced	3	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
153	Коврик придверный 750х450	Коврик придверный 750х450	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	Остатки до 15.08.25	\N	t	2025-09-04 09:35:27.463417	2025-09-04 09:35:27.463417	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
60	ЛЕЖ	ЛЕЖ-1700x1100x24-ЧЕШУЙ-ШИП7-1СОРТ	3	\N	7	\N	\N	{"width": 1100, "length": 1700, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:44:24.650373	2025-09-08 11:38:50.618	\N	\N	1.9092	without_border	1	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
51	ЛЕЖ	ЛЕЖ-1700x1100x24-ЧЕШУЙ-ШИП7-2СОРТ	3	\N	7	\N	\N	{"width": 1100, "length": 1700, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:11:03.341501	2025-09-08 11:41:44.743	\N	\N	1.9092	without_border	1	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
50	ЛЕЖ	ЛЕЖ-1800x1200x24-ЧЕШУЙ-ШИП7-2СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:09:29.29441	2025-09-08 11:42:52.806	\N	\N	2.172	without_border	1	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
54	ЛЕЖ	ЛЕЖ-1700x1100x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 1110, "length": 1700, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:15:37.400595	2025-09-09 11:16:22.429	\N	\N	1.887	without_border	1	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
47	ЛЕЖ	ЛЕЖ-2050x1200x24-ЧЕШУЙ-ШИП7-2СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 2050, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:38:14.463766	2025-09-02 19:27:06.712372	\N	\N	2.4926	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
40	ЛЕЖ	ЛЕЖ-1500x800x24-ЧЕШУЙ-GEA-ШИП7-1СОРТ	3	\N	11	4	\N	{"width": 800, "length": 1500, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:21:37.644737	2025-09-02 19:27:06.712372	\N	\N	1.2312	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
41	ЛЕЖ	ЛЕЖ-1600x800x24-ЧЕШУЙ-GEA-ШИП7-1СОРТ	3	\N	11	4	\N	{"width": 800, "length": 1600, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:22:59.416236	2025-09-02 19:27:06.712372	\N	\N	1.3041	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
49	ЛЕЖ	ЛЕЖ-1930x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	3	\N	11	6	\N	{"width": 1200, "length": 1930, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 06:41:02.487926	2025-09-02 19:27:06.712372	\N	\N	2.3353	without_border	1	normal	6	\N	1	usual	direct_cut	carpet	\N	{11}	not_selected
122	ПУР4	ПУР4	4	\N	\N	\N	\N	{"width": 4, "length": 4, "thickness": 4}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:40:41.81959	2025-09-02 07:40:41.81959	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pur	4	\N	\N
2	мат	МАТ-1750x1200x24-ЧЕШУЙ-ШИП5-4ст нов лит п-усил-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 1750, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-20 11:14:05.28692	2025-09-02 19:09:20.182494	\N	\N	2.1	\N	4	reinforced	3	3	4	usual	direct_cut	carpet	\N	{7}	not_selected
69	мат	МАТ-1900x1200x21-ЧЕШУЙ-ШИП2-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 1900, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 08:46:05.325418	2025-09-02 19:09:20.182494	\N	\N	2.28	\N	1	normal	2	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
73	мат	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 10:43:52.124262	2025-09-02 19:09:20.182494	\N	\N	0.9295	\N	1	normal	3	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
79	мат	МАТ-1300x715x10-ЧЕШУЙ-ШИП0-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 10}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 11:23:29.469735	2025-09-02 19:09:20.182494	\N	\N	0.9295	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
85	ВЕРБ	ВЕРБ-1950x1200x30-ЧЕШУЙ-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1950, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:05:32.91858	2025-09-02 19:09:20.182494	\N	\N	2.3595	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
131	ЛЕЖАК	Лежак - 1800x1185x30 - Чеш - СБорт,НеУсил	3	\N	\N	\N	\N	{"width": 1185, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-09-03 11:40:15.833035	2025-09-03 11:40:15.833035	\N	\N	2.133	with_border	1	weak	\N	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
139	ЛЕЖАК	Лежак - 1800x1200x40 - 1Кор - НеУсил	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 40}	\N	\N	\N	\N	0	Старые	\N	t	2025-09-03 12:05:40.701158	2025-09-03 12:05:40.701158	\N	\N	2.16	without_border	1	weak	\N	\N	1	usual	straight_cut	carpet	\N	{9}	not_selected
64	мат	МАТ-2000x1200x21-ЧЕРТ-ШИП0-1СОРТ	2	\N	6	\N	\N	{"width": 1200, "length": 2030, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:57:13.613359	2025-09-04 07:21:47.272	\N	\N	2.4563	without_border	1	normal	\N	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
74	мат	МАТ-1300x715x21-ЧЕШУЙ-ШИП2-1СОРТ	2	\N	7	\N	\N	{"width": 715, "length": 1300, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 10:47:09.801592	2025-09-04 07:40:38.4	\N	\N	0.9295	without_border	1	normal	\N	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
86	ВЕРБ	ВЕРБ-1830x1200x30-ЧЕРТ-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1830, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:06:41.201205	2025-09-02 19:09:20.182494	\N	\N	2.2143	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
87	ВЕРБ	ВЕРБ-1830x1100x30-ЧЕРТ-1СОРТ	3	\N	6	\N	\N	{"width": 1100, "length": 1830, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:08:13.655431	2025-09-02 19:09:20.182494	\N	\N	2.0313	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
88	ВЕРБ	ВЕРБ-1830x1100x30-ЧЕШУЙ-1СОРТ	3	\N	7	\N	\N	{"width": 1100, "length": 1830, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:10:05.240923	2025-09-02 19:09:20.182494	\N	\N	2.0313	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
83	ВЕРБ	ВЕРБ-2000x1200x30-ЧЕШУЙ-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 2010, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:02:47.171637	2025-09-02 19:09:20.182494	\N	\N	2.4321	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
89	ВЕРБ	ВЕРБ-1950x1200x30-ЧЕРТ-Прям рез-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1950, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:11:25.387774	2025-09-02 19:09:20.182494	\N	\N	2.34	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
90	ВЕРБ	ВЕРБ-1800x1200x30-ЧЕРТ-Прям рез-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:12:51.314485	2025-09-02 19:09:20.182494	\N	\N	2.16	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
146	ЛЕЖ	Леж - 1800x1100x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 1100, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-04 08:34:40.711194	2025-09-04 08:34:40.711194	\N	\N	1.98	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
154	Скребок бол. с мет.	Скребок бол. с мет.	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	t	2025-09-04 09:37:10.2339	2025-09-04 09:37:10.2339	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
168	ЛЕЖ	Леж - 225x1190x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 1190, "length": 225, "thickness": 24}	\N	\N	\N	\N	0	Из брака	\N	t	2025-09-08 17:52:22.781309	2025-09-08 17:52:22.781309	\N	\N	0.2677	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
175	ЛЕЖ	Леж - 1450x780x24 - Чеш - 7Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 780, "length": 1450, "thickness": 24}	\N	\N	\N	\N	0	резка 24-29.08	\N	t	2025-09-09 06:13:15.099322	2025-09-09 06:13:15.099322	\N	\N	1.131	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
182	ЛЕЖ	Леж - 325x1200x30 - Черт - 11Шип - Пазл1стСтар	3	\N	\N	\N	\N	{"width": 1200, "length": 325, "thickness": 30}	\N	\N	\N	\N	0	резка 04.09	\N	t	2025-09-09 06:51:17.786363	2025-09-09 06:51:17.786363	\N	\N	0.39	without_border	1	normal	5	1	1	usual	puzzle	carpet	\N	{6}	not_selected
161	Рулонное покр	Покрытие - 18600x1000x21 - Черт - 0Шип - 15.5Ковр	2	\N	\N	\N	\N	{"width": 1000, "length": 18600, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	f	2025-09-04 11:36:37.612428	2025-09-11 10:49:56.731	\N	\N	18.6	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
188	мат	Мат - 1279x700x24 - Чеш - Шип5 - Пазл4стСтарый 04.2025 - Прот	2	\N	\N	\N	1	{"width": 700, "length": 1279, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-11 12:58:13.818223	2025-09-11 12:58:13.818223	\N	\N	0.8953	without_border	4	normal	3	2	4	usual	puzzle	carpet	\N	{7}	not_selected
193	Рулонное покр	Покрытие - 35000x2000x21 - Черт - Шип0 - 29.5Ковр	3	\N	\N	\N	\N	{"width": 2000, "length": 35000, "thickness": 21}	\N	\N	\N	\N	0	1195х2000х21 чёрт Ш0	\N	t	2025-09-11 13:40:50.15842	2025-09-11 13:40:50.15842	\N	\N	70	\N	\N	\N	1	\N	\N	\N	\N	roll_covering	\N	{6}	not_selected
101	ЛЕЖАК	ЛЕЖАК-1800x1200x30-ЧЕШУЙ-ЛИБЕР	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:25:52.733337	2025-09-03 11:19:29.874	\N	\N	2.16	\N	1	normal	1	\N	1	grade_2	direct_cut	carpet	\N	{7}	not_selected
96	ЛЕЖАК	ЛЕЖ-1800x1200x30-ЧЕШУЙ-не ус-УКР-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-22 12:30:02.581431	2025-09-03 11:19:37.618	\N	\N	2.16	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
98	ЛЕЖАК	ЛЕЖАК-1800x1200x30-ЧЕШУЙ-не ус-КИТ-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-22 12:56:21.220857	2025-09-03 11:19:44.564	\N	\N	2.16	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
102	ЛЕЖАК	ЛЕЖАК-1800x1200x40-ЧЕШУЙ-не ус-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 40}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:42:22.887882	2025-09-03 11:19:50.915	\N	\N	2.16	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
103	ЛЕЖАК	ЛЕЖАК-1800x1200x40-ЧЕШУЙ-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 40}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:45:47.574466	2025-09-03 11:19:58.168	\N	\N	2.16	without_border	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
105	ЛЕЖАК	ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-не ус-1СОРТ	3	\N	10	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:50:11.163902	2025-09-03 11:20:09.524	\N	\N	2.16	with_border	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
106	ЛЕЖАК	ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-1СОРТ	3	\N	10	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	f	2025-08-25 06:51:29.965653	2025-09-03 11:20:17.296	\N	\N	2.16	with_border	1	reinforced	1	\N	1	usual	direct_cut	carpet	\N	{10}	not_selected
123	ПУР3	ПУР3	4	\N	\N	\N	\N	{"width": 3, "length": 3, "thickness": 3}	\N	\N	\N	\N	0	\N	\N	t	2025-09-02 07:42:30.046408	2025-09-02 07:42:30.046408	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	pur	3	\N	\N
91	ВЕРБ	ВЕРБ-1900x1200x30-ЧЕШУЙ-Прям рез-1СОРТ	3	\N	7	\N	\N	{"width": 1200, "length": 1900, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:14:38.144527	2025-09-02 19:09:20.182494	\N	\N	2.28	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
65	мат	МАТ-2000x1200x21-ЧЕШУЙ-ШИП0-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2000, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:58:11.619631	2025-09-02 19:09:20.182494	\N	\N	2.4321	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
84	ВЕРБ	ВЕРБ-1950x1200x30-ЧЕРТ-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1950, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:04:16.702234	2025-09-02 19:09:20.182494	\N	\N	2.3595	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
92	ВЕРБ	ВЕРБ-1700x1200x30-ЧЕРТ-1СОРТ	3	\N	6	\N	\N	{"width": 1200, "length": 1700, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:16:09.622787	2025-09-02 19:09:20.182494	\N	\N	2.0691	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
93	ВЕРБ	ВЕРБ-1830x1000x30-ЧЕШУЙ-1СОРТ	3	\N	7	\N	\N	{"width": 1000, "length": 1830, "thickness": 30}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 12:17:44.297103	2025-09-02 19:09:20.182494	\N	\N	1.8483	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
66	мат	МАТ-1800x1200x21-ЧЕШУЙ-ШИП0-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 1800, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 07:59:09.458255	2025-09-02 19:09:20.182494	\N	\N	2.1901	\N	1	normal	1	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
4	мат	МАТ-1800x1190x24-ЧЕРТ-ШИП5-2ст нов п-1СОРТ	2	\N	6	\N	\N	{"width": 1190, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-20 11:23:11.183334	2025-09-02 19:09:20.182494	\N	\N	2.142	\N	2	normal	3	3	2	usual	direct_cut	carpet	\N	{6}	not_selected
5	мат	МАТ-1500x1190x24-ЧЕРТ-ШИП5-2ст стар п-1СОРТ	2	\N	6	\N	\N	{"width": 1190, "length": 1500, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-20 11:37:59.45963	2025-09-02 19:09:20.182494	\N	\N	1.785	\N	2	normal	3	1	2	usual	direct_cut	carpet	\N	{6}	not_selected
6	мат	МАТ-1850x1100x24-ЧЕРТ-ШИП5-2ст стар п-1СОРТ	2	\N	6	\N	\N	{"width": 1100, "length": 1850, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-08-21 06:06:56.396499	2025-09-02 19:09:20.182494	\N	\N	2.035	\N	2	normal	3	1	2	usual	direct_cut	carpet	\N	{6}	not_selected
68	мат	МАТ-2050x1200x21-ЧЕРТ-ШИП2-1СОРТ	2	\N	6	\N	\N	{"width": 1200, "length": 2050, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 08:44:40.140096	2025-09-02 19:09:20.182494	\N	\N	2.4926	\N	1	normal	2	\N	1	usual	direct_cut	carpet	\N	{6}	not_selected
71	мат	МАТ-2030x1200x21-ЧЕШУЙ-ШИП2-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2030, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 08:49:11.371099	2025-09-02 19:09:20.182494	\N	\N	2.4563	\N	1	normal	2	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
72	мат	МАТ-2000x1200x21-ЧЕШУЙ-ШИП2-1СОРТ	2	\N	7	\N	\N	{"width": 1200, "length": 2000, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 08:52:00.639103	2025-09-02 19:09:20.182494	\N	\N	2.4321	\N	1	normal	2	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
132	ЛЕЖАК	Лежак - 1800x1200x30 - Чеш - КитПресс	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 30}	\N	\N	\N	\N	0	Бывшая 40ка	\N	t	2025-09-03 11:47:34.106876	2025-09-03 11:47:34.106876	\N	\N	2.16	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{7}	chinese
140	ЛЕЖАК	Лежак - 1800x1200x35 - 1Кор - СБорт,НеУсил	3	\N	\N	\N	\N	{"width": 1200, "length": 1800, "thickness": 35}	\N	\N	\N	\N	0	старые	\N	t	2025-09-03 12:07:37.407991	2025-09-03 12:07:37.407991	\N	\N	2.16	with_border	1	weak	\N	\N	1	usual	straight_cut	carpet	\N	{9}	not_selected
147	ЛЕЖ	Леж - 1800x1000x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 1000, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	16.08-02.09	\N	t	2025-09-04 08:41:08.98443	2025-09-04 08:41:08.98443	\N	\N	1.8	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
155	Скребок мал.	Скребок мал.	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	t	2025-09-04 09:38:10.834163	2025-09-04 09:38:10.834163	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	other	\N	\N	\N
67	мат	МАТ-1930x1200x21-ЧЕРТ-ШИП2-1СОРТ	2	\N	6	\N	\N	{"width": 1200, "length": 1930, "thickness": 21}	\N	\N	\N	\N	0	\N	\N	t	2025-08-22 08:42:50.736371	2025-09-05 06:18:46.657	\N	\N	2.3232	without_border	1	normal	\N	\N	1	usual	straight_cut	carpet	\N	{6}	not_selected
162	ЛЕЖ	Леж - 1800x900x24 - Чеш - 7Шип	3	\N	\N	\N	\N	{"width": 900, "length": 1800, "thickness": 24}	\N	\N	\N	\N	0	\N	\N	t	2025-09-05 06:39:00.663856	2025-09-05 06:39:00.663856	\N	\N	1.62	without_border	1	normal	4	\N	1	usual	straight_cut	carpet	\N	{7}	not_selected
169	ВЕРБ	Верб - 1900x1200x30 - Чеш - Либер	3	\N	\N	\N	\N	{"width": 1200, "length": 1900, "thickness": 30}	\N	\N	\N	\N	0	Для Либерти из брака (40 порезали из 2000х1200)	\N	t	2025-09-08 18:16:33.912803	2025-09-08 18:16:33.912803	\N	\N	2.28	without_border	1	normal	\N	\N	1	liber	straight_cut	carpet	\N	{7}	not_selected
176	ЛЕЖ	Леж - 500x1000x24 - Чеш - 7Шип - ПрямРез4ст	3	\N	\N	\N	\N	{"width": 1000, "length": 500, "thickness": 24}	\N	\N	\N	\N	0	резка 25.08	\N	t	2025-09-09 06:15:46.902547	2025-09-09 06:15:46.902547	\N	\N	0.5	without_border	4	normal	4	\N	1	usual	direct_cut	carpet	\N	{7}	not_selected
\.


--
-- Data for Name: products_bottom_type_fix_backup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products_bottom_type_fix_backup (id, article, bottom_type_id, created_at, updated_at) FROM stdin;
61	ЛЕЖ-2000x1190x24-ЧЕШУЙ-ШИП7-4ст стар п-1СОРТ	\N	2025-08-22 07:46:20.881572	2025-09-02 09:42:32.224
125	Мат - 1300x715x24 - 5Шип - Пазл4стСтар п/с	\N	2025-09-02 08:04:48.130303	2025-09-02 08:06:44.656
48	ЛЕЖ-1950x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	\N	2025-08-22 06:39:48.020712	2025-09-02 19:09:20.182494
43	ЛЕЖ-1800x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 06:29:59.943915	2025-09-02 19:09:20.182494
42	ЛЕЖ-1800x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	\N	2025-08-22 06:24:24.688731	2025-09-02 19:09:20.182494
45	ЛЕЖ-2050x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 06:35:45.956089	2025-09-02 19:09:20.182494
44	ЛЕЖ-1850x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 06:34:05.031795	2025-09-02 19:09:20.182494
46	ЛЕЖ-2030x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 06:37:03.910098	2025-09-02 19:09:20.182494
47	ЛЕЖ-2050x1200x24-ЧЕШУЙ-ШИП7-2СОРТ	\N	2025-08-22 06:38:14.463766	2025-09-02 19:09:20.182494
40	ЛЕЖ-1500x800x24-ЧЕШУЙ-GEA-ШИП7-1СОРТ	\N	2025-08-22 06:21:37.644737	2025-09-02 19:09:20.182494
41	ЛЕЖ-1600x800x24-ЧЕШУЙ-GEA-ШИП7-1СОРТ	\N	2025-08-22 06:22:59.416236	2025-09-02 19:09:20.182494
49	ЛЕЖ-1930x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	\N	2025-08-22 06:41:02.487926	2025-09-02 19:09:20.182494
53	ЛЕЖ-1600x800x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 07:13:53.993596	2025-09-02 19:09:20.182494
56	ЛЕЖ-1930x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 07:27:41.882252	2025-09-02 19:09:20.182494
62	ЛЕЖ-1600x800x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	\N	2025-08-22 07:48:18.454223	2025-09-02 19:09:20.182494
59	ЛЕЖ-1600x780x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	\N	2025-08-22 07:33:42.083579	2025-09-02 19:09:20.182494
58	ЛЕЖ-1600x980x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	\N	2025-08-22 07:32:07.985635	2025-09-02 19:09:20.182494
57	ЛЕЖ-1600x880x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	\N	2025-08-22 07:29:09.20923	2025-09-02 19:09:20.182494
52	ЛЕЖ-1600x1000x24-ЧЕШУЙ-ШИП7-1СОРТ	\N	2025-08-22 07:12:23.72199	2025-09-02 19:09:20.182494
\.


--
-- Data for Name: products_carpet_edge_backup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products_carpet_edge_backup (id, article, name, carpet_edge_type, created_at, updated_at) FROM stdin;
63	МАТ-2050x1200x21-ЧЕШУЙ-GEA-ШИП0-Подпазл-1СОРТ	мат	podpuzzle	2025-08-22 07:55:51.151004	2025-08-27 12:48:17.461
7	\N	Тест grade_2	straight_cut	2025-08-21 06:35:57.762535	2025-08-21 06:37:34.863
8	МАТ-1890x1160x24-ЧЕШУЙ-ШИП5-4ст стар п-2СОРТ	мат	straight_cut	2025-08-21 06:46:19.303814	2025-08-21 07:17:10.95
27	ЛЕЖ-1800x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:01:15.01923	2025-08-21 12:01:15.01923
28	ЛЕЖ-1800x1185x30-ЧЕШУЙ-ШИП11-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:04:01.442775	2025-08-21 12:04:01.442775
29	ЛЕЖ-1800x1200x30-ЧЕРТ-ШИП11-2СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:06:31.995197	2025-08-21 12:06:31.995197
30	ЛЕЖ-1800x1200x30-ЧЕРТ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:24:29.064153	2025-08-21 12:24:29.064153
10	МАТ-2050x1200x24-ЧЕШУЙ-АГРОТ-ШИП5-Подпазл-1СОРТ	мат	straight_cut	2025-08-21 10:25:54.975924	2025-08-27 12:17:11.782
11	МАТ-2050x1200x24-ЧЕШУЙ-ШИП5-Усил-Подпазл-1СОРТ	мат	podpuzzle	2025-08-21 10:30:10.603543	2025-08-27 12:18:21.699
12	МАТ-2050x1200x24-ЧЕШУЙ-ШИП5-1СОРТ	мат	straight_cut	2025-08-21 10:32:47.29075	2025-08-27 12:19:27.013
13	МАТ-1750x1200x24-ЧЕРТ-ШИП5-1СОРТ	мат	straight_cut	2025-08-21 10:34:23.456202	2025-08-27 12:20:41.615
15	МАТ-2050x1200x24-ЧЕРТ-ШИП5-1СОРТ	мат	straight_cut	2025-08-21 10:38:39.583889	2025-08-27 12:21:48.035
14	МАТ-1990x1200x24-ЧЕШУЙ-ШИП5-1СОРТ	мат	straight_cut	2025-08-21 10:37:17.112664	2025-08-27 12:24:36.229
16	МАТ-1600x900x24-ЧЕШУЙ-ШИП5-1СОРТ	мат	straight_cut	2025-08-21 10:40:33.77827	2025-08-27 12:25:18.667
17	МАТ-2050x1200x24-ЧЕШУЙ-ШИП5-усил-1СОРТ	мат	straight_cut	2025-08-21 11:12:14.976236	2025-08-27 12:26:17.076
19	МАТ-1750x1200x24-ЧЕШУЙ-ШИП5-лит п-1СОРТ	мат	litoy_puzzle	2025-08-21 11:19:22.141491	2025-08-27 12:27:43.106
9	МАТ-2000x1200x24-ЧЕШУЙ-ШИП5-4ст нов лит п-1СОРТ	мат	litoy_puzzle	2025-08-21 07:21:45.411841	2025-08-27 12:30:55.933
31	ЛЕЖ-1930x1200x30-ЧЕРТ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:25:55.041393	2025-08-21 12:25:55.041393
32	ЛЕЖ-1800x1190x30-ЧЕРТ-ШИП11-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:27:45.870447	2025-08-21 12:27:45.870447
33	ЛЕЖ-1800x1190x30-ЧЕШУЙ-ШИП11-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:29:26.175059	2025-08-21 12:30:03.065
34	ЛЕЖ-1700x1190x30-ЧЕРТ-ШИП11-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:31:42.206798	2025-08-21 12:32:08.302
36	ЛЕЖ-1900x1190x30-ЧЕШУЙ-ШИП11-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:35:04.577343	2025-08-21 12:35:04.577343
37	ЛЕЖ-1930x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:36:23.069008	2025-08-21 12:36:23.069008
60	МАТ-1700x1100x24-ЧЕШУЙ-ШИП7-1СОРТ	мат	straight_cut	2025-08-22 07:44:24.650373	2025-08-27 12:49:35.126
54	МАТ-1700x1110x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	мат	straight_cut	2025-08-22 07:15:37.400595	2025-08-22 07:15:37.400595
38	ЛЕЖ-1850x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:37:33.754633	2025-08-27 11:50:14.372
35	ЛЕЖ-2030x1200x30-ЧЕРТ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:33:33.755585	2025-08-27 11:51:54.335
51	МАТ-1700x1100x24-ЧЕШУЙ-ШИП7-2СОРТ	мат	straight_cut	2025-08-22 07:11:03.341501	2025-08-27 13:16:11.799
50	МАТ-1800x1200x24-ЧЕШУЙ-ШИП7-2СОРТ	мат	straight_cut	2025-08-22 07:09:29.29441	2025-08-27 13:16:58.966
21	МАТ-1750x1200x24-ЧЕШУЙ-ШИП5-усил-1СОРТ	мат	straight_cut	2025-08-21 11:25:53.624947	2025-08-27 13:18:26.11
45	ЛЕЖ-2050x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:35:45.956089	2025-09-02 08:27:40.89
44	ЛЕЖ-1850x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:34:05.031795	2025-09-02 08:29:01.464
46	ЛЕЖ-2030x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:37:03.910098	2025-09-02 08:30:00.69
47	ЛЕЖ-2050x1200x24-ЧЕШУЙ-ШИП7-2СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:38:14.463766	2025-09-02 08:31:06.786
40	ЛЕЖ-1500x800x24-ЧЕШУЙ-GEA-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:21:37.644737	2025-09-02 08:45:37.323
41	ЛЕЖ-1600x800x24-ЧЕШУЙ-GEA-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:22:59.416236	2025-09-02 08:46:46.121
49	ЛЕЖ-1930x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:41:02.487926	2025-09-02 08:47:38.814
53	ЛЕЖ-1600x800x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:13:53.993596	2025-09-02 09:03:17.047
56	ЛЕЖ-1930x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:27:41.882252	2025-09-02 09:25:54.2
62	ЛЕЖ-1600x800x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:48:18.454223	2025-09-02 09:27:10.398
59	ЛЕЖ-1600x780x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:33:42.083579	2025-09-02 09:43:14.511
58	ЛЕЖ-1600x980x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:32:07.985635	2025-09-02 09:43:56.479
57	ЛЕЖ-1600x880x24-ЧЕШУЙ-ШИП7-Прям рез-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:29:09.20923	2025-09-02 09:44:57.232
52	ЛЕЖ-1600x1000x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 07:12:23.72199	2025-09-02 09:45:42.88
64	МАТ-2030x1200x21-ЧЕРТ-ШИП0-1СОРТ	мат	straight_cut	2025-08-22 07:57:13.613359	2025-08-27 12:55:53.485
2	МАТ-1750x1200x24-ЧЕШУЙ-ШИП5-4ст нов лит п-усил-1СОРТ	мат	straight_cut	2025-08-20 11:14:05.28692	2025-08-27 13:24:23.497
69	МАТ-1900x1200x21-ЧЕШУЙ-ШИП2-1СОРТ	мат	straight_cut	2025-08-22 08:46:05.325418	2025-08-22 08:46:05.325418
73	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-1СОРТ	мат	straight_cut	2025-08-22 10:43:52.124262	2025-08-22 10:43:52.124262
74	МАТ-1300x715x24-ЧЕШУЙ-ШИП2-1СОРТ	мат	straight_cut	2025-08-22 10:47:09.801592	2025-08-22 10:47:09.801592
75	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-Подпазл-1СОРТ	мат	podpuzzle	2025-08-22 10:49:13.915138	2025-08-22 10:49:13.915138
76	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-Литой пазл-1СОРТ	мат	litoy_puzzle	2025-08-22 11:01:13.694089	2025-08-22 11:01:13.694089
77	МАТ-1300x715x24-ЧЕШУЙ-ШИП5-Литой пазл обрез-1СОРТ	мат	litoy_puzzle	2025-08-22 11:08:59.332159	2025-08-22 11:10:56.381
79	МАТ-1300x715x10-ЧЕШУЙ-ШИП0-1СОРТ	мат	straight_cut	2025-08-22 11:23:29.469735	2025-08-22 11:23:29.469735
85	ВЕРБ-1950x1200x30-ЧЕШУЙ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:05:32.91858	2025-08-27 11:42:58.414
86	ВЕРБ-1830x1200x30-ЧЕРТ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:06:41.201205	2025-08-27 11:43:42.434
87	ВЕРБ-1830x1100x30-ЧЕРТ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:08:13.655431	2025-08-27 11:44:27.52
88	ВЕРБ-1830x1100x30-ЧЕШУЙ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:10:05.240923	2025-08-27 11:45:13.656
83	ВЕРБ-2000x1200x30-ЧЕШУЙ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:02:47.171637	2025-08-27 11:45:59.849
89	ВЕРБ-1950x1200x30-ЧЕРТ-Прям рез-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:11:25.387774	2025-08-26 06:28:02.39
90	ВЕРБ-1800x1200x30-ЧЕРТ-Прям рез-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:12:51.314485	2025-08-26 06:29:14.22
91	ВЕРБ-1900x1200x30-ЧЕШУЙ-Прям рез-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:14:38.144527	2025-08-26 06:29:47.507
65	МАТ-2000x1200x21-ЧЕШУЙ-ШИП0-1СОРТ	мат	straight_cut	2025-08-22 07:58:11.619631	2025-08-27 11:53:36.119
84	ВЕРБ-1950x1200x30-ЧЕРТ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:04:16.702234	2025-08-27 11:42:07.63
92	ВЕРБ-1700x1200x30-ЧЕРТ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:16:09.622787	2025-08-27 11:41:39.468
93	ВЕРБ-1830x1000x30-ЧЕШУЙ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:17:44.297103	2025-08-27 11:46:42.389
66	МАТ-1800x1200x21-ЧЕШУЙ-ШИП0-1СОРТ	мат	straight_cut	2025-08-22 07:59:09.458255	2025-08-27 11:54:32.268
67	МАТ-1900x1200x21-ЧЕРТ-ШИП2-1СОРТ	мат	straight_cut	2025-08-22 08:42:50.736371	2025-08-27 11:55:12.387
117	ПУР 5	ПУР5	straight_cut	2025-09-02 06:59:41.31859	2025-09-02 07:01:27.303
1	МАТ-1750x1200x24-ЧЕШУЙ-GEA-ШИП5-4ст нов лит п-усил-1СОРТ	мат	straight_cut	2025-08-20 11:09:40.599727	2025-08-21 07:07:56.579
3	МАТ-1720x1160x24-ЧЕШУЙ-GEA-ШИП5-4ст стар п-1СОРТ	мат	straight_cut	2025-08-20 11:20:21.774894	2025-08-21 07:13:05.039
4	МАТ-1800x1190x24-ЧЕРТ-ШИП5-2ст нов п-1СОРТ	мат	straight_cut	2025-08-20 11:23:11.183334	2025-08-21 07:14:52.326
5	МАТ-1500x1190x24-ЧЕРТ-ШИП5-2ст стар п-1СОРТ	мат	straight_cut	2025-08-20 11:37:59.45963	2025-08-21 07:15:35.457
6	МАТ-1850x1100x24-ЧЕРТ-ШИП5-2ст стар п-1СОРТ	мат	straight_cut	2025-08-21 06:06:56.396499	2025-08-21 07:16:27.315
68	МАТ-2050x1200x21-ЧЕРТ-ШИП2-1СОРТ	мат	straight_cut	2025-08-22 08:44:40.140096	2025-08-27 11:56:37.695
71	МАТ-2030x1200x21-ЧЕШУЙ-ШИП2-1СОРТ	мат	straight_cut	2025-08-22 08:49:11.371099	2025-08-27 11:57:13.477
72	МАТ-2000x1200x21-ЧЕШУЙ-ШИП2-1СОРТ	мат	straight_cut	2025-08-22 08:52:00.639103	2025-08-27 12:14:37.65
96	ЛЕЖ-1800x1200x30-ЧЕШУЙ-не ус-УКР-1СОРТ	ЛЕЖАК	straight_cut	2025-08-22 12:30:02.581431	2025-08-22 12:31:34.172
98	ЛЕЖАК-1800x1200x30-ЧЕШУЙ-не ус-КИТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-22 12:56:21.220857	2025-08-25 07:27:13.272
101	ЛЕЖАК-1800x1200x30-ЧЕШУЙ-ЛИБЕР	ЛЕЖАК	straight_cut	2025-08-25 06:25:52.733337	2025-08-25 06:39:14.705
102	ЛЕЖАК-1800x1200x40-ЧЕШУЙ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:42:22.887882	2025-08-25 06:42:22.887882
103	ЛЕЖАК-1800x1200x40-ЧЕШУЙ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:45:47.574466	2025-08-25 06:45:47.574466
105	ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:50:11.163902	2025-08-25 06:50:11.163902
106	ЛЕЖАК-1800x1200x30-3КОР-СБОРТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:51:29.965653	2025-08-25 06:51:29.965653
107	ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:53:14.179127	2025-08-25 06:53:14.179127
108	ЛЕЖАК-1800x1185x30-3КОР-СБОРТ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:55:25.825604	2025-08-25 06:55:25.825604
109	ЛЕЖАК-1800x1200x40-1КОР-СБОРТ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:04:15.564376	2025-08-25 07:06:04.85
110	ЛЕЖАК-1800x1200x35-1КОР-СБОРТ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:08:26.06843	2025-08-25 07:08:26.06843
111	ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:14:15.630196	2025-08-25 07:14:15.630196
104	ЛЕЖАК-1800x1185x35-3КОР-СБОРТ-ЛИБЕР	ЛЕЖАК	straight_cut	2025-08-25 06:47:57.480798	2025-08-25 07:15:00.174
118	ПУР6	ПУР6	straight_cut	2025-09-02 07:02:55.255676	2025-09-02 07:32:25.728
48	ЛЕЖ-1950x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:39:48.020712	2025-09-02 08:49:37.228
119	ПУР 7	ПУР7	straight_cut	2025-09-02 07:04:22.725627	2025-09-02 07:32:59.207
43	ЛЕЖ-1800x1200x24-ЧЕШУЙ-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:29:59.943915	2025-09-02 08:19:38.933
42	ЛЕЖ-1800x1200x24-ЧЕШУЙ-VELES-ШИП7-1СОРТ	ЛЕЖ	straight_cut	2025-08-22 06:24:24.688731	2025-09-02 08:26:09.8
97	ЛЕЖАК-1800x1185x30-ЧЕШУЙ-СБОРТ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-22 12:35:03.586385	2025-08-22 12:35:03.586385
99	ЛЕЖАК-1800x1195x35-ЧЕШУЙ-не ус-1СОРТ	ЛЕЖАК	straight_cut	2025-08-22 13:02:28.971916	2025-08-22 13:02:28.971916
115	ЛЕЖАК-1800x1175x30-3КОР-БЕЗБОРТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:22:14.394893	2025-08-25 07:22:14.394893
100	ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 06:12:30.249559	2025-08-25 06:14:58.545
112	ЛЕЖАК-1800x1200x30-ЧЕШУЙ-СБОРТ-GEA-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:17:07.902254	2025-08-25 07:17:07.902254
113	ЛЕЖАК-1800x1200x35-ЧЕШУЙ-СБОРТ-АГРОТ-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:19:01.815003	2025-08-25 07:19:01.815003
114	ЛЕЖАК-1800x1165x30-3КОР-1СОРТ	ЛЕЖАК	straight_cut	2025-08-25 07:20:44.806095	2025-08-25 07:20:44.806095
95	ВЕРБ-1830x1200x30-ЧЕРТ-Прям рез-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:22:02.558725	2025-08-26 06:33:40.229
94	ВЕРБ-1950x1000x30-ЧЕРТ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:19:28.924949	2025-08-27 11:47:16.173
82	ВЕРБ-2030x1200x30-ЧЕРТ-1СОРТ	ВЕРБ	straight_cut	2025-08-22 12:00:29.793292	2025-08-27 11:48:01.664
39	ЛЕЖ-2030x1200x30-ЧЕШУЙ-ШИП11-1СОРТ	ЛЕЖ	straight_cut	2025-08-21 12:38:51.751346	2025-08-27 11:49:10.096
\.


--
-- Data for Name: puzzle_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.puzzle_types (id, name, code, description, is_system, created_at) FROM stdin;
1	Старый	old	Стандартный старый тип паззла	t	2025-07-23 10:07:23.280802
2	Старый 04.2025	old_04_2025	Обновленная версия старого типа паззла	t	2025-07-23 10:07:23.280802
3	Новый	new	Новый тип паззла с улучшенными характеристиками	t	2025-07-23 10:07:23.280802
4	Узкий	narrow	Узкий паззл для специальных применений	t	2025-07-23 10:07:23.280802
5	Широкий	wide	Широкий паззл для больших площадей	t	2025-07-23 10:07:23.280802
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role, permission_id, created_at) FROM stdin;
372	director	1	2025-07-22 12:31:32.158015
373	director	2	2025-07-22 12:31:32.165718
374	director	3	2025-07-22 12:31:32.170005
375	director	4	2025-07-22 12:31:32.178038
376	director	5	2025-07-22 12:31:32.183716
377	director	6	2025-07-22 12:31:32.19076
378	director	7	2025-07-22 12:31:32.197441
379	director	8	2025-07-22 12:31:32.202308
380	director	9	2025-07-22 12:31:32.207376
381	director	10	2025-07-22 12:31:32.213119
382	director	11	2025-07-22 12:31:32.217963
383	director	12	2025-07-22 12:31:32.223128
384	director	13	2025-07-22 12:31:32.229705
385	director	14	2025-07-22 12:31:32.235207
386	director	15	2025-07-22 12:31:32.242129
387	director	16	2025-07-22 12:31:32.248857
388	director	17	2025-07-22 12:31:32.255071
389	director	18	2025-07-22 12:31:32.260172
390	director	19	2025-07-22 12:31:32.264996
391	director	20	2025-07-22 12:31:32.270063
392	director	21	2025-07-22 12:31:32.27454
393	director	22	2025-07-22 12:31:32.279749
394	director	23	2025-07-22 12:31:32.285824
395	director	24	2025-07-22 12:31:32.290518
3551	director	1	2025-08-29 07:49:47.3193
3552	director	2	2025-08-29 07:49:47.32349
3553	director	3	2025-08-29 07:49:47.327035
3554	director	4	2025-08-29 07:49:47.33043
3555	director	5	2025-08-29 07:49:47.333749
3556	director	6	2025-08-29 07:49:47.337023
3557	director	7	2025-08-29 07:49:47.33999
3558	director	8	2025-08-29 07:49:47.342793
3559	director	9	2025-08-29 07:49:47.345589
3560	director	10	2025-08-29 07:49:47.348285
3561	director	11	2025-08-29 07:49:47.350908
3562	director	12	2025-08-29 07:49:47.353608
3563	director	13	2025-08-29 07:49:47.356808
3564	director	14	2025-08-29 07:49:47.35942
4971	director	1	2025-09-12 12:20:01.377599
4972	director	2	2025-09-12 12:20:01.385491
4973	director	3	2025-09-12 12:20:01.392659
4974	director	4	2025-09-12 12:20:01.400598
4975	director	5	2025-09-12 12:20:01.406626
4976	director	6	2025-09-12 12:20:01.414096
4977	director	7	2025-09-12 12:20:01.430453
4978	director	8	2025-09-12 12:20:01.436146
4979	director	9	2025-09-12 12:20:01.445676
1301	director	1	2025-08-20 07:57:39.086734
1302	director	2	2025-08-20 07:57:39.094664
1303	director	3	2025-08-20 07:57:39.099615
1304	director	4	2025-08-20 07:57:39.110859
1305	director	5	2025-08-20 07:57:39.116356
1306	director	6	2025-08-20 07:57:39.12313
425	director	1	2025-07-22 12:39:14.306255
426	director	2	2025-07-22 12:39:14.31289
427	director	3	2025-07-22 12:39:14.317595
428	director	4	2025-07-22 12:39:14.322208
429	director	5	2025-07-22 12:39:14.327761
430	director	6	2025-07-22 12:39:14.332848
431	director	7	2025-07-22 12:39:14.340339
432	director	8	2025-07-22 12:39:14.346782
433	director	9	2025-07-22 12:39:14.351696
434	director	10	2025-07-22 12:39:14.356128
435	director	11	2025-07-22 12:39:14.360901
436	director	12	2025-07-22 12:39:14.365166
437	director	13	2025-07-22 12:39:14.369635
438	director	14	2025-07-22 12:39:14.375292
439	director	15	2025-07-22 12:39:14.38015
440	director	16	2025-07-22 12:39:14.38412
441	director	17	2025-07-22 12:39:14.390132
442	director	18	2025-07-22 12:39:14.395158
443	director	19	2025-07-22 12:39:14.401108
444	director	20	2025-07-22 12:39:14.40552
445	director	21	2025-07-22 12:39:14.410607
446	director	22	2025-07-22 12:39:14.414837
447	director	23	2025-07-22 12:39:14.420145
448	director	24	2025-07-22 12:39:14.425665
3565	director	15	2025-08-29 07:49:47.362064
3566	director	16	2025-08-29 07:49:47.364648
3567	director	17	2025-08-29 07:49:47.367167
3568	director	18	2025-08-29 07:49:47.369884
3569	director	19	2025-08-29 07:49:47.372298
3570	director	20	2025-08-29 07:49:47.375219
3571	director	21	2025-08-29 07:49:47.378414
3572	director	22	2025-08-29 07:49:47.381833
3573	director	23	2025-08-29 07:49:47.385033
3574	director	24	2025-08-29 07:49:47.388856
3575	director	361	2025-08-29 07:49:47.392291
3576	director	362	2025-08-29 07:49:47.395257
3577	director	363	2025-08-29 07:49:47.398271
3578	director	364	2025-08-29 07:49:47.400843
4980	director	10	2025-09-12 12:20:01.449231
4981	director	11	2025-09-12 12:20:01.45648
4982	director	12	2025-09-12 12:20:01.463692
4983	director	13	2025-09-12 12:20:01.469799
4984	director	14	2025-09-12 12:20:01.481119
4985	director	15	2025-09-12 12:20:01.490431
4986	director	16	2025-09-12 12:20:01.524357
4987	director	17	2025-09-12 12:20:01.535888
4988	director	18	2025-09-12 12:20:01.541701
1307	director	7	2025-08-20 07:57:39.12912
1308	director	8	2025-08-20 07:57:39.134146
1309	director	9	2025-08-20 07:57:39.141741
1310	director	10	2025-08-20 07:57:39.147076
1311	director	11	2025-08-20 07:57:39.151791
1312	director	12	2025-08-20 07:57:39.156484
478	director	1	2025-07-22 12:50:38.306825
479	director	2	2025-07-22 12:50:38.345213
480	director	3	2025-07-22 12:50:38.353589
481	director	4	2025-07-22 12:50:38.358503
482	director	5	2025-07-22 12:50:38.366528
483	director	6	2025-07-22 12:50:38.375386
484	director	7	2025-07-22 12:50:38.381753
485	director	8	2025-07-22 12:50:38.387265
486	director	9	2025-07-22 12:50:38.402275
487	director	10	2025-07-22 12:50:38.407994
488	director	11	2025-07-22 12:50:38.412318
489	director	12	2025-07-22 12:50:38.419922
490	director	13	2025-07-22 12:50:38.425207
491	director	14	2025-07-22 12:50:38.430907
492	director	15	2025-07-22 12:50:38.436741
493	director	16	2025-07-22 12:50:38.442326
494	director	17	2025-07-22 12:50:38.448157
495	director	18	2025-07-22 12:50:38.453404
496	director	19	2025-07-22 12:50:38.457934
497	director	20	2025-07-22 12:50:38.462623
498	director	21	2025-07-22 12:50:38.467513
499	director	22	2025-07-22 12:50:38.472043
500	director	23	2025-07-22 12:50:38.4765
501	director	24	2025-07-22 12:50:38.48221
3579	director	365	2025-08-29 07:49:47.40357
3580	manager	1	2025-08-29 07:49:47.405983
3581	manager	2	2025-08-29 07:49:47.408518
3582	manager	3	2025-08-29 07:49:47.411227
3583	manager	361	2025-08-29 07:49:47.413733
3584	manager	5	2025-08-29 07:49:47.416217
3585	manager	8	2025-08-29 07:49:47.422239
3586	manager	9	2025-08-29 07:49:47.427839
3587	manager	10	2025-08-29 07:49:47.435144
3588	manager	11	2025-08-29 07:49:47.440387
3589	manager	362	2025-08-29 07:49:47.457114
3590	manager	12	2025-08-29 07:49:47.461585
3591	manager	15	2025-08-29 07:49:47.471673
3592	manager	16	2025-08-29 07:49:47.478177
4989	director	19	2025-09-12 12:20:01.547453
4990	director	20	2025-09-12 12:20:01.555502
4991	director	21	2025-09-12 12:20:01.55905
4992	director	22	2025-09-12 12:20:01.56285
4993	director	23	2025-09-12 12:20:01.568003
4994	director	24	2025-09-12 12:20:01.576655
4995	director	361	2025-09-12 12:20:01.594194
4996	director	362	2025-09-12 12:20:01.598749
4997	director	363	2025-09-12 12:20:01.615271
1313	director	13	2025-08-20 07:57:39.161858
1314	director	14	2025-08-20 07:57:39.167645
1315	director	15	2025-08-20 07:57:39.172844
1316	director	16	2025-08-20 07:57:39.182584
1317	director	17	2025-08-20 07:57:39.187268
1318	director	18	2025-08-20 07:57:39.192426
531	director	1	2025-07-23 09:54:51.062258
532	director	2	2025-07-23 09:54:51.080804
533	director	3	2025-07-23 09:54:51.091308
534	director	4	2025-07-23 09:54:51.097052
535	director	5	2025-07-23 09:54:51.110001
536	director	6	2025-07-23 09:54:51.11443
537	director	7	2025-07-23 09:54:51.121718
538	director	8	2025-07-23 09:54:51.129457
539	director	9	2025-07-23 09:54:51.134698
540	director	10	2025-07-23 09:54:51.139867
541	director	11	2025-07-23 09:54:51.145321
542	director	12	2025-07-23 09:54:51.15039
543	director	13	2025-07-23 09:54:51.154924
544	director	14	2025-07-23 09:54:51.159909
545	director	15	2025-07-23 09:54:51.165225
546	director	16	2025-07-23 09:54:51.170508
547	director	17	2025-07-23 09:54:51.175234
548	director	18	2025-07-23 09:54:51.17966
549	director	19	2025-07-23 09:54:51.184133
550	director	20	2025-07-23 09:54:51.190726
551	director	21	2025-07-23 09:54:51.195778
552	director	22	2025-07-23 09:54:51.200769
553	director	23	2025-07-23 09:54:51.206275
554	director	24	2025-07-23 09:54:51.211465
3593	manager	18	2025-08-29 07:49:47.482545
3594	manager	19	2025-08-29 07:49:47.487127
3595	manager	20	2025-08-29 07:49:47.492762
3596	manager	365	2025-08-29 07:49:47.496246
4998	director	364	2025-09-12 12:20:01.621418
4999	director	365	2025-09-12 12:20:01.625244
5000	manager	1	2025-09-12 12:20:01.632396
5001	manager	2	2025-09-12 12:20:01.645637
5002	manager	3	2025-09-12 12:20:01.655449
5003	manager	361	2025-09-12 12:20:01.658851
5004	manager	5	2025-09-12 12:20:01.664052
5005	manager	8	2025-09-12 12:20:01.667297
5006	manager	9	2025-09-12 12:20:01.681396
5007	manager	10	2025-09-12 12:20:01.686819
5008	manager	11	2025-09-12 12:20:01.706089
5009	manager	362	2025-09-12 12:20:01.717884
5010	manager	12	2025-09-12 12:20:01.730811
5011	manager	15	2025-09-12 12:20:01.745657
5012	manager	16	2025-09-12 12:20:01.74924
5013	manager	18	2025-09-12 12:20:01.755425
5014	manager	19	2025-09-12 12:20:01.759907
5015	manager	20	2025-09-12 12:20:01.766514
5016	manager	365	2025-09-12 12:20:01.778608
1319	director	19	2025-08-20 07:57:39.198035
1320	director	20	2025-08-20 07:57:39.202711
1321	director	21	2025-08-20 07:57:39.208185
1322	director	22	2025-08-20 07:57:39.214102
1323	director	23	2025-08-20 07:57:39.219412
1324	director	24	2025-08-20 07:57:39.224421
584	director	1	2025-07-28 10:46:07.80698
585	director	2	2025-07-28 10:46:07.811813
586	director	3	2025-07-28 10:46:07.815584
587	director	4	2025-07-28 10:46:07.819778
588	director	5	2025-07-28 10:46:07.825571
589	director	6	2025-07-28 10:46:07.829591
590	director	7	2025-07-28 10:46:07.833559
591	director	8	2025-07-28 10:46:07.837102
592	director	9	2025-07-28 10:46:07.840617
593	director	10	2025-07-28 10:46:07.844179
594	director	11	2025-07-28 10:46:07.848198
595	director	12	2025-07-28 10:46:07.851936
596	director	13	2025-07-28 10:46:07.855646
597	director	14	2025-07-28 10:46:07.864583
598	director	15	2025-07-28 10:46:07.872754
599	director	16	2025-07-28 10:46:07.876507
600	director	17	2025-07-28 10:46:07.88344
601	director	18	2025-07-28 10:46:07.888812
602	director	19	2025-07-28 10:46:07.893621
603	director	20	2025-07-28 10:46:07.897073
604	director	21	2025-07-28 10:46:07.900637
605	director	22	2025-07-28 10:46:07.904321
606	director	23	2025-07-28 10:46:07.909114
607	director	24	2025-07-28 10:46:07.913753
5017	production	1	2025-09-12 12:20:01.78376
3608	warehouse	1	2025-08-29 07:49:47.546163
3609	warehouse	361	2025-08-29 07:49:47.553013
3610	warehouse	5	2025-08-29 07:49:47.55624
3611	warehouse	6	2025-08-29 07:49:47.560333
3612	warehouse	8	2025-08-29 07:49:47.56613
3613	warehouse	18	2025-08-29 07:49:47.571405
3614	warehouse	20	2025-08-29 07:49:47.574649
3615	warehouse	365	2025-08-29 07:49:47.580787
4006	director	1	2025-08-29 11:49:15.686449
4007	director	2	2025-08-29 11:49:15.691963
4008	director	3	2025-08-29 11:49:15.695432
4009	director	4	2025-08-29 11:49:15.699557
4010	director	5	2025-08-29 11:49:15.704665
5018	production	5	2025-09-12 12:20:01.795581
5019	production	8	2025-09-12 12:20:01.802316
5020	production	12	2025-09-12 12:20:01.810828
5021	production	13	2025-09-12 12:20:01.814217
5022	production	14	2025-09-12 12:20:01.837596
5023	production	363	2025-09-12 12:20:01.867038
5024	production	15	2025-09-12 12:20:01.876221
5025	production	17	2025-09-12 12:20:01.89128
5026	production	364	2025-09-12 12:20:01.925939
1325	director	361	2025-08-20 07:57:39.230461
1326	director	362	2025-08-20 07:57:39.235135
1327	director	363	2025-08-20 07:57:39.24038
1328	director	364	2025-08-20 07:57:39.246185
1329	director	365	2025-08-20 07:57:39.253697
4011	director	6	2025-08-29 11:49:15.711334
637	director	1	2025-07-28 17:36:43.202444
638	director	2	2025-07-28 17:36:43.20855
639	director	3	2025-07-28 17:36:43.213442
640	director	4	2025-07-28 17:36:43.218938
641	director	5	2025-07-28 17:36:43.222625
642	director	6	2025-07-28 17:36:43.231544
643	director	7	2025-07-28 17:36:43.236571
644	director	8	2025-07-28 17:36:43.241623
645	director	9	2025-07-28 17:36:43.248916
646	director	10	2025-07-28 17:36:43.253415
647	director	11	2025-07-28 17:36:43.258042
648	director	12	2025-07-28 17:36:43.26422
649	director	13	2025-07-28 17:36:43.269644
650	director	14	2025-07-28 17:36:43.274372
651	director	15	2025-07-28 17:36:43.278845
652	director	16	2025-07-28 17:36:43.283705
653	director	17	2025-07-28 17:36:43.288018
654	director	18	2025-07-28 17:36:43.29276
655	director	19	2025-07-28 17:36:43.296772
656	director	20	2025-07-28 17:36:43.30071
657	director	21	2025-07-28 17:36:43.305031
658	director	22	2025-07-28 17:36:43.309257
659	director	23	2025-07-28 17:36:43.330397
660	director	24	2025-07-28 17:36:43.335204
4012	director	7	2025-08-29 11:49:15.716622
4013	director	8	2025-08-29 11:49:15.719807
4014	director	9	2025-08-29 11:49:15.724688
4015	director	10	2025-08-29 11:49:15.728613
4016	director	11	2025-08-29 11:49:15.732915
4017	director	12	2025-08-29 11:49:15.735828
4018	director	13	2025-08-29 11:49:15.740533
4019	director	14	2025-08-29 11:49:15.746986
4020	director	15	2025-08-29 11:49:15.749984
4021	director	16	2025-08-29 11:49:15.752676
4022	director	17	2025-08-29 11:49:15.755069
4023	director	18	2025-08-29 11:49:15.757728
4024	director	19	2025-08-29 11:49:15.760322
4025	director	20	2025-08-29 11:49:15.762857
5027	production	18	2025-09-12 12:20:01.936208
5028	warehouse	1	2025-09-12 12:20:01.958571
5029	warehouse	361	2025-09-12 12:20:01.980473
5030	warehouse	5	2025-09-12 12:20:01.990898
5031	warehouse	6	2025-09-12 12:20:01.997913
5032	warehouse	8	2025-09-12 12:20:02.004172
5033	warehouse	18	2025-09-12 12:20:02.017657
5034	warehouse	20	2025-09-12 12:20:02.027015
5035	warehouse	365	2025-09-12 12:20:02.049
4026	director	21	2025-08-29 11:49:15.76533
4027	director	22	2025-08-29 11:49:15.768032
3616	director	1	2025-08-29 08:30:21.330394
3617	director	2	2025-08-29 08:30:21.334007
3618	director	3	2025-08-29 08:30:21.336643
3619	director	4	2025-08-29 08:30:21.339209
690	director	1	2025-07-28 17:59:09.069689
691	director	2	2025-07-28 17:59:09.075052
692	director	3	2025-07-28 17:59:09.079906
693	director	4	2025-07-28 17:59:09.084876
694	director	5	2025-07-28 17:59:09.090125
695	director	6	2025-07-28 17:59:09.097366
696	director	7	2025-07-28 17:59:09.105124
697	director	8	2025-07-28 17:59:09.112612
698	director	9	2025-07-28 17:59:09.117863
699	director	10	2025-07-28 17:59:09.121637
700	director	11	2025-07-28 17:59:09.125269
701	director	12	2025-07-28 17:59:09.128694
702	director	13	2025-07-28 17:59:09.132495
703	director	14	2025-07-28 17:59:09.136366
704	director	15	2025-07-28 17:59:09.140217
705	director	16	2025-07-28 17:59:09.150124
706	director	17	2025-07-28 17:59:09.153915
707	director	18	2025-07-28 17:59:09.159836
708	director	19	2025-07-28 17:59:09.164466
709	director	20	2025-07-28 17:59:09.169043
710	director	21	2025-07-28 17:59:09.173013
711	director	22	2025-07-28 17:59:09.177471
712	director	23	2025-07-28 17:59:09.181123
713	director	24	2025-07-28 17:59:09.184906
3620	director	5	2025-08-29 08:30:21.34172
3621	director	6	2025-08-29 08:30:21.344061
3622	director	7	2025-08-29 08:30:21.346588
3623	director	8	2025-08-29 08:30:21.349135
3624	director	9	2025-08-29 08:30:21.352052
3625	director	10	2025-08-29 08:30:21.355798
3626	director	11	2025-08-29 08:30:21.358671
3627	director	12	2025-08-29 08:30:21.361636
3628	director	13	2025-08-29 08:30:21.365367
3629	director	14	2025-08-29 08:30:21.368388
3630	director	15	2025-08-29 08:30:21.371099
3631	director	16	2025-08-29 08:30:21.373671
3632	director	17	2025-08-29 08:30:21.376628
3633	director	18	2025-08-29 08:30:21.382727
5036	director	1	2025-09-16 20:22:14.516314
5037	director	2	2025-09-16 20:22:14.524044
5038	director	3	2025-09-16 20:22:14.547846
5039	director	4	2025-09-16 20:22:14.568209
5040	director	5	2025-09-16 20:22:14.572618
5041	director	6	2025-09-16 20:22:14.621171
5042	director	7	2025-09-16 20:22:14.639367
5043	director	8	2025-09-16 20:22:14.653764
5044	director	9	2025-09-16 20:22:14.658407
3634	director	19	2025-08-29 08:30:21.38634
3635	director	20	2025-08-29 08:30:21.390004
3636	director	21	2025-08-29 08:30:21.393102
3637	director	22	2025-08-29 08:30:21.396113
3638	director	23	2025-08-29 08:30:21.398993
3639	director	24	2025-08-29 08:30:21.401844
3640	director	361	2025-08-29 08:30:21.404739
3641	director	362	2025-08-29 08:30:21.407188
3642	director	363	2025-08-29 08:30:21.409781
3643	director	364	2025-08-29 08:30:21.41215
3644	director	365	2025-08-29 08:30:21.414521
3645	manager	1	2025-08-29 08:30:21.416714
3646	manager	2	2025-08-29 08:30:21.419217
3647	manager	3	2025-08-29 08:30:21.422349
3648	manager	361	2025-08-29 08:30:21.424905
3649	manager	5	2025-08-29 08:30:21.427769
3650	manager	8	2025-08-29 08:30:21.430384
3651	manager	9	2025-08-29 08:30:21.432771
3652	manager	10	2025-08-29 08:30:21.435274
3653	manager	11	2025-08-29 08:30:21.437789
3654	manager	362	2025-08-29 08:30:21.440304
3655	manager	12	2025-08-29 08:30:21.443216
3656	manager	15	2025-08-29 08:30:21.44606
3657	manager	16	2025-08-29 08:30:21.4492
3658	manager	18	2025-08-29 08:30:21.45198
3659	manager	19	2025-08-29 08:30:21.454779
3660	manager	20	2025-08-29 08:30:21.457665
3661	manager	365	2025-08-29 08:30:21.460785
5045	director	10	2025-09-16 20:22:14.666891
5046	director	11	2025-09-16 20:22:14.672502
5047	director	12	2025-09-16 20:22:14.677353
5048	director	13	2025-09-16 20:22:14.681448
5049	director	14	2025-09-16 20:22:14.685094
5050	director	15	2025-09-16 20:22:14.691327
5051	director	16	2025-09-16 20:22:14.698372
5052	director	17	2025-09-16 20:22:14.709401
5053	director	18	2025-09-16 20:22:14.714965
5054	director	19	2025-09-16 20:22:14.720763
5055	director	20	2025-09-16 20:22:14.728511
3673	warehouse	1	2025-08-29 08:30:21.523382
3674	warehouse	361	2025-08-29 08:30:21.52687
3675	warehouse	5	2025-08-29 08:30:21.52975
3676	warehouse	6	2025-08-29 08:30:21.532191
1041	director	1	2025-08-01 13:34:59.76791
1042	director	2	2025-08-01 13:34:59.775559
1043	director	3	2025-08-01 13:34:59.78092
1044	director	4	2025-08-01 13:34:59.785152
1045	director	5	2025-08-01 13:34:59.78936
1046	director	6	2025-08-01 13:34:59.79398
1047	director	7	2025-08-01 13:34:59.799186
1048	director	8	2025-08-01 13:34:59.804054
1049	director	9	2025-08-01 13:34:59.809681
1050	director	10	2025-08-01 13:34:59.815289
1051	director	11	2025-08-01 13:34:59.819785
1052	director	12	2025-08-01 13:34:59.827611
1053	director	13	2025-08-01 13:34:59.831605
1054	director	14	2025-08-01 13:34:59.845327
1055	director	15	2025-08-01 13:34:59.85064
1056	director	16	2025-08-01 13:34:59.855474
1057	director	17	2025-08-01 13:34:59.86
1058	director	18	2025-08-01 13:34:59.865715
1059	director	19	2025-08-01 13:34:59.870539
1060	director	20	2025-08-01 13:34:59.874729
1061	director	21	2025-08-01 13:34:59.879549
1062	director	22	2025-08-01 13:34:59.884387
1063	director	23	2025-08-01 13:34:59.889421
1064	director	24	2025-08-01 13:34:59.895103
1065	director	361	2025-08-01 13:34:59.899251
1066	director	362	2025-08-01 13:34:59.904522
1067	director	363	2025-08-01 13:34:59.9084
1068	director	364	2025-08-01 13:34:59.91276
1069	director	365	2025-08-01 13:34:59.918195
3677	warehouse	8	2025-08-29 08:30:21.534862
3678	warehouse	18	2025-08-29 08:30:21.5378
3679	warehouse	20	2025-08-29 08:30:21.540685
3680	warehouse	365	2025-08-29 08:30:21.543994
4028	director	23	2025-08-29 11:49:15.771495
4029	director	24	2025-08-29 11:49:15.774959
4030	director	361	2025-08-29 11:49:15.778527
4031	director	362	2025-08-29 11:49:15.781515
4032	director	363	2025-08-29 11:49:15.784962
4033	director	364	2025-08-29 11:49:15.788419
4034	director	365	2025-08-29 11:49:15.791906
4035	manager	1	2025-08-29 11:49:15.795204
4036	manager	2	2025-08-29 11:49:15.798675
4037	manager	3	2025-08-29 11:49:15.801958
4038	manager	361	2025-08-29 11:49:15.804803
4039	manager	5	2025-08-29 11:49:15.807353
4040	manager	8	2025-08-29 11:49:15.810009
5056	director	21	2025-09-16 20:22:14.737046
5057	director	22	2025-09-16 20:22:14.741873
5058	director	23	2025-09-16 20:22:14.746756
5059	director	24	2025-09-16 20:22:14.750561
5060	director	361	2025-09-16 20:22:14.761715
5061	director	362	2025-09-16 20:22:14.767963
5062	director	363	2025-09-16 20:22:14.772825
5063	director	364	2025-09-16 20:22:14.777863
5064	director	365	2025-09-16 20:22:14.782103
5065	director	1213	2025-09-16 20:22:14.784889
5066	director	1216	2025-09-16 20:22:14.793413
4041	manager	9	2025-08-29 11:49:15.812563
4042	manager	10	2025-08-29 11:49:15.81505
4043	manager	11	2025-08-29 11:49:15.817642
4044	manager	362	2025-08-29 11:49:15.819986
4045	manager	12	2025-08-29 11:49:15.823036
4046	manager	15	2025-08-29 11:49:15.825543
976	director	1	2025-08-01 13:32:57.794496
977	director	2	2025-08-01 13:32:57.79983
978	director	3	2025-08-01 13:32:57.803774
979	director	4	2025-08-01 13:32:57.815441
980	director	5	2025-08-01 13:32:57.823929
981	director	6	2025-08-01 13:32:57.828516
982	director	7	2025-08-01 13:32:57.83315
983	director	8	2025-08-01 13:32:57.838352
984	director	9	2025-08-01 13:32:57.847138
985	director	10	2025-08-01 13:32:57.852449
986	director	11	2025-08-01 13:32:57.856848
987	director	12	2025-08-01 13:32:57.860702
988	director	13	2025-08-01 13:32:57.865793
989	director	14	2025-08-01 13:32:57.869707
990	director	15	2025-08-01 13:32:57.874262
991	director	16	2025-08-01 13:32:57.87796
3681	director	1	2025-08-29 09:02:21.600469
3682	director	2	2025-08-29 09:02:21.604554
3683	director	3	2025-08-29 09:02:21.607012
3684	director	4	2025-08-29 09:02:21.609262
3685	director	5	2025-08-29 09:02:21.611651
3686	director	6	2025-08-29 09:02:21.613942
3687	director	7	2025-08-29 09:02:21.616519
5067	director	1220	2025-09-16 20:22:14.797866
5068	director	1222	2025-09-16 20:22:14.807042
5069	director	1225	2025-09-16 20:22:14.811745
5070	manager	1	2025-09-16 20:22:14.818178
5071	manager	2	2025-09-16 20:22:14.82281
5072	manager	3	2025-09-16 20:22:14.82799
5073	manager	361	2025-09-16 20:22:14.83169
5074	manager	5	2025-09-16 20:22:14.839006
5075	manager	8	2025-09-16 20:22:14.842526
5076	manager	9	2025-09-16 20:22:14.848229
5077	manager	10	2025-09-16 20:22:14.855784
3688	director	8	2025-08-29 09:02:21.618884
3689	director	9	2025-08-29 09:02:21.621087
3690	director	10	2025-08-29 09:02:21.623408
3691	director	11	2025-08-29 09:02:21.625812
3692	director	12	2025-08-29 09:02:21.628243
3693	director	13	2025-08-29 09:02:21.630555
3694	director	14	2025-08-29 09:02:21.633034
3695	director	15	2025-08-29 09:02:21.635478
1368	director	1	2025-08-20 11:05:35.534771
1369	director	2	2025-08-20 11:05:35.547416
1370	director	3	2025-08-20 11:05:35.555319
1371	director	4	2025-08-20 11:05:35.559783
1372	director	5	2025-08-20 11:05:35.563838
1373	director	6	2025-08-20 11:05:35.570029
1374	director	7	2025-08-20 11:05:35.576794
1375	director	8	2025-08-20 11:05:35.580793
1376	director	9	2025-08-20 11:05:35.584898
1377	director	10	2025-08-20 11:05:35.588726
1378	director	11	2025-08-20 11:05:35.594445
1379	director	12	2025-08-20 11:05:35.598274
992	director	17	2025-08-01 13:32:57.882509
993	director	18	2025-08-01 13:32:57.887055
994	director	19	2025-08-01 13:32:57.891277
995	director	20	2025-08-01 13:32:57.896125
996	director	21	2025-08-01 13:32:57.900417
997	director	22	2025-08-01 13:32:57.905643
998	director	23	2025-08-01 13:32:57.910148
999	director	24	2025-08-01 13:32:57.914594
1000	director	361	2025-08-01 13:32:57.919575
1001	director	362	2025-08-01 13:32:57.923759
1002	director	363	2025-08-01 13:32:57.927346
1003	director	364	2025-08-01 13:32:57.934144
1004	director	365	2025-08-01 13:32:57.940874
3696	director	16	2025-08-29 09:02:21.637542
3697	director	17	2025-08-29 09:02:21.640072
3698	director	18	2025-08-29 09:02:21.642417
3699	director	19	2025-08-29 09:02:21.644647
3700	director	20	2025-08-29 09:02:21.646959
3701	director	21	2025-08-29 09:02:21.648889
3702	director	22	2025-08-29 09:02:21.651678
3703	director	23	2025-08-29 09:02:21.653726
3704	director	24	2025-08-29 09:02:21.65578
3705	director	361	2025-08-29 09:02:21.658058
3706	director	362	2025-08-29 09:02:21.660542
3707	director	363	2025-08-29 09:02:21.66287
3708	director	364	2025-08-29 09:02:21.66506
3709	director	365	2025-08-29 09:02:21.667226
3710	manager	1	2025-08-29 09:02:21.669269
3711	manager	2	2025-08-29 09:02:21.672102
3712	manager	3	2025-08-29 09:02:21.674809
5078	manager	11	2025-09-16 20:22:14.860426
5079	manager	1213	2025-09-16 20:22:14.872511
5080	manager	362	2025-09-16 20:22:14.876837
5081	manager	12	2025-09-16 20:22:14.882284
5082	manager	1216	2025-09-16 20:22:14.888157
5083	manager	15	2025-09-16 20:22:14.894611
5084	manager	16	2025-09-16 20:22:14.899606
5085	manager	1222	2025-09-16 20:22:14.902695
5086	manager	18	2025-09-16 20:22:14.906148
5087	manager	19	2025-09-16 20:22:14.909744
5088	manager	1225	2025-09-16 20:22:14.916549
3713	manager	361	2025-08-29 09:02:21.677994
3714	manager	5	2025-08-29 09:02:21.68146
3715	manager	8	2025-08-29 09:02:21.684923
3716	manager	9	2025-08-29 09:02:21.688033
3717	manager	10	2025-08-29 09:02:21.69132
3718	manager	11	2025-08-29 09:02:21.694218
3719	manager	362	2025-08-29 09:02:21.697139
3720	manager	12	2025-08-29 09:02:21.699656
3721	manager	15	2025-08-29 09:02:21.701853
3722	manager	16	2025-08-29 09:02:21.704211
1106	director	1	2025-08-01 13:43:39.455566
1107	director	2	2025-08-01 13:43:39.460842
1108	director	3	2025-08-01 13:43:39.465217
1109	director	4	2025-08-01 13:43:39.470446
1110	director	5	2025-08-01 13:43:39.475116
1111	director	6	2025-08-01 13:43:39.479117
1112	director	7	2025-08-01 13:43:39.484566
1113	director	8	2025-08-01 13:43:39.488741
1114	director	9	2025-08-01 13:43:39.494755
1115	director	10	2025-08-01 13:43:39.498756
1116	director	11	2025-08-01 13:43:39.504723
1117	director	12	2025-08-01 13:43:39.509036
1118	director	13	2025-08-01 13:43:39.513085
1119	director	14	2025-08-01 13:43:39.517791
1120	director	15	2025-08-01 13:43:39.521946
1121	director	16	2025-08-01 13:43:39.526201
1122	director	17	2025-08-01 13:43:39.530876
1123	director	18	2025-08-01 13:43:39.535455
1124	director	19	2025-08-01 13:43:39.551202
1125	director	20	2025-08-01 13:43:39.558023
1126	director	21	2025-08-01 13:43:39.565885
1127	director	22	2025-08-01 13:43:39.573598
1128	director	23	2025-08-01 13:43:39.579462
1129	director	24	2025-08-01 13:43:39.587415
1130	director	361	2025-08-01 13:43:39.593945
1131	director	362	2025-08-01 13:43:39.598863
1132	director	363	2025-08-01 13:43:39.605832
1133	director	364	2025-08-01 13:43:39.613512
1134	director	365	2025-08-01 13:43:39.619888
3723	manager	18	2025-08-29 09:02:21.706588
3724	manager	19	2025-08-29 09:02:21.709047
5089	manager	20	2025-09-16 20:22:14.920645
5090	manager	365	2025-09-16 20:22:14.926661
5091	manager	21	2025-09-16 20:22:14.932433
5092	production	1	2025-09-16 20:22:14.93699
5093	production	5	2025-09-16 20:22:14.942931
5094	production	8	2025-09-16 20:22:14.949516
1380	director	13	2025-08-20 11:05:35.602031
1381	director	14	2025-08-20 11:05:35.605807
1382	director	15	2025-08-20 11:05:35.65645
1383	director	16	2025-08-20 11:05:35.660796
1384	director	17	2025-08-20 11:05:35.664944
1385	director	18	2025-08-20 11:05:35.66974
1386	director	19	2025-08-20 11:05:35.674068
1387	director	20	2025-08-20 11:05:35.678395
1388	director	21	2025-08-20 11:05:35.690154
1389	director	22	2025-08-20 11:05:35.694544
1390	director	23	2025-08-20 11:05:35.698726
1391	director	24	2025-08-20 11:05:35.703027
1392	director	361	2025-08-20 11:05:35.707636
5095	production	12	2025-09-16 20:22:14.95521
5096	production	13	2025-09-16 20:22:14.959205
5097	production	1216	2025-09-16 20:22:14.964159
5098	production	14	2025-09-16 20:22:14.967704
5099	production	363	2025-09-16 20:22:14.971155
3725	manager	20	2025-08-29 09:02:21.711352
3726	manager	365	2025-08-29 09:02:21.713956
5100	production	15	2025-09-16 20:22:14.978268
5101	production	17	2025-09-16 20:22:14.986208
5102	production	1222	2025-09-16 20:22:15.007675
5103	production	364	2025-09-16 20:22:15.012164
5104	production	18	2025-09-16 20:22:15.021197
5105	warehouse	1	2025-09-16 20:22:15.03089
1171	director	1	2025-08-01 13:52:35.003484
1172	director	2	2025-08-01 13:52:35.009787
1173	director	3	2025-08-01 13:52:35.016853
1174	director	4	2025-08-01 13:52:35.02144
1175	director	5	2025-08-01 13:52:35.02635
1176	director	6	2025-08-01 13:52:35.032215
1177	director	7	2025-08-01 13:52:35.036117
1178	director	8	2025-08-01 13:52:35.039759
1179	director	9	2025-08-01 13:52:35.043281
1180	director	10	2025-08-01 13:52:35.047237
1181	director	11	2025-08-01 13:52:35.052221
1182	director	12	2025-08-01 13:52:35.059196
1183	director	13	2025-08-01 13:52:35.063215
1184	director	14	2025-08-01 13:52:35.066884
1185	director	15	2025-08-01 13:52:35.070611
1186	director	16	2025-08-01 13:52:35.074641
1187	director	17	2025-08-01 13:52:35.078286
1188	director	18	2025-08-01 13:52:35.082728
1189	director	19	2025-08-01 13:52:35.087863
1190	director	20	2025-08-01 13:52:35.096608
1191	director	21	2025-08-01 13:52:35.116726
1192	director	22	2025-08-01 13:52:35.121818
1193	director	23	2025-08-01 13:52:35.12787
1194	director	24	2025-08-01 13:52:35.135194
1195	director	361	2025-08-01 13:52:35.13906
1196	director	362	2025-08-01 13:52:35.144555
1197	director	363	2025-08-01 13:52:35.148394
1198	director	364	2025-08-01 13:52:35.154244
1199	director	365	2025-08-01 13:52:35.159086
5106	warehouse	361	2025-09-16 20:22:15.039224
5107	warehouse	5	2025-09-16 20:22:15.044936
5108	warehouse	6	2025-09-16 20:22:15.053939
5109	warehouse	8	2025-09-16 20:22:15.075793
5110	warehouse	18	2025-09-16 20:22:15.082254
3738	warehouse	1	2025-08-29 09:02:21.744242
3739	warehouse	361	2025-08-29 09:02:21.74681
3740	warehouse	5	2025-08-29 09:02:21.749009
3741	warehouse	6	2025-08-29 09:02:21.751071
3742	warehouse	8	2025-08-29 09:02:21.754632
3743	warehouse	18	2025-08-29 09:02:21.756936
3744	warehouse	20	2025-08-29 09:02:21.759263
3745	warehouse	365	2025-08-29 09:02:21.761482
4047	manager	16	2025-08-29 11:49:15.828195
4048	manager	18	2025-08-29 11:49:15.831297
4049	manager	19	2025-08-29 11:49:15.833686
4050	manager	20	2025-08-29 11:49:15.836055
5111	warehouse	20	2025-09-16 20:22:15.093496
5112	warehouse	365	2025-09-16 20:22:15.101194
5267	director	1	2025-09-17 10:01:22.628432
5268	director	2	2025-09-17 10:01:22.851995
5269	director	3	2025-09-17 10:01:22.954913
5270	director	4	2025-09-17 10:01:22.988028
5271	director	5	2025-09-17 10:01:23.052847
5272	director	6	2025-09-17 10:01:23.112071
5273	director	7	2025-09-17 10:01:23.149874
5274	director	8	2025-09-17 10:01:23.181457
5275	director	9	2025-09-17 10:01:23.206067
4051	manager	365	2025-08-29 11:49:15.83903
5276	director	10	2025-09-17 10:01:23.22887
5277	director	11	2025-09-17 10:01:23.265035
5278	director	12	2025-09-17 10:01:23.281644
5279	director	13	2025-09-17 10:01:23.294998
5280	director	14	2025-09-17 10:01:23.307721
5281	director	15	2025-09-17 10:01:23.323109
5282	director	16	2025-09-17 10:01:23.332336
1236	director	1	2025-08-01 13:53:22.242314
1237	director	2	2025-08-01 13:53:22.246828
1238	director	3	2025-08-01 13:53:22.250724
1239	director	4	2025-08-01 13:53:22.254717
1240	director	5	2025-08-01 13:53:22.259191
1241	director	6	2025-08-01 13:53:22.265711
1242	director	7	2025-08-01 13:53:22.270682
1243	director	8	2025-08-01 13:53:22.277332
1244	director	9	2025-08-01 13:53:22.28513
1245	director	10	2025-08-01 13:53:22.290611
1246	director	11	2025-08-01 13:53:22.29559
1247	director	12	2025-08-01 13:53:22.300894
1248	director	13	2025-08-01 13:53:22.307379
1249	director	14	2025-08-01 13:53:22.31122
1250	director	15	2025-08-01 13:53:22.316108
1251	director	16	2025-08-01 13:53:22.320812
1252	director	17	2025-08-01 13:53:22.326284
1253	director	18	2025-08-01 13:53:22.331679
1254	director	19	2025-08-01 13:53:22.337132
1255	director	20	2025-08-01 13:53:22.340827
1256	director	21	2025-08-01 13:53:22.34538
1257	director	22	2025-08-01 13:53:22.35006
1258	director	23	2025-08-01 13:53:22.354589
1259	director	24	2025-08-01 13:53:22.358983
1260	director	361	2025-08-01 13:53:22.363819
1261	director	362	2025-08-01 13:53:22.368373
1262	director	363	2025-08-01 13:53:22.372325
1263	director	364	2025-08-01 13:53:22.37746
1264	director	365	2025-08-01 13:53:22.382641
5283	director	17	2025-09-17 10:01:23.341475
5284	director	18	2025-09-17 10:01:23.353769
5285	director	19	2025-09-17 10:01:23.366762
5286	director	20	2025-09-17 10:01:23.386575
4063	warehouse	1	2025-08-29 11:49:15.866974
4064	warehouse	361	2025-08-29 11:49:15.869184
4065	warehouse	5	2025-08-29 11:49:15.871502
4066	warehouse	6	2025-08-29 11:49:15.874046
4067	warehouse	8	2025-08-29 11:49:15.877912
4068	warehouse	18	2025-08-29 11:49:15.880314
4069	warehouse	20	2025-08-29 11:49:15.882712
4070	warehouse	365	2025-08-29 11:49:15.886397
4266	production	1	2025-09-04 10:27:59.233566
4267	production	5	2025-09-04 10:27:59.233566
4268	production	8	2025-09-04 10:27:59.233566
4269	production	12	2025-09-04 10:27:59.233566
4270	production	13	2025-09-04 10:27:59.233566
5287	director	21	2025-09-17 10:01:23.408625
5288	director	22	2025-09-17 10:01:23.421108
5289	director	23	2025-09-17 10:01:23.43688
5290	director	24	2025-09-17 10:01:23.448713
5291	director	361	2025-09-17 10:01:23.457247
5292	director	362	2025-09-17 10:01:23.473401
5293	director	363	2025-09-17 10:01:23.49611
5294	director	364	2025-09-17 10:01:23.518074
5295	director	365	2025-09-17 10:01:23.535338
5296	director	1213	2025-09-17 10:01:23.546301
5297	director	1216	2025-09-17 10:01:23.561966
4271	production	14	2025-09-04 10:27:59.233566
4272	production	15	2025-09-04 10:27:59.233566
4273	production	17	2025-09-04 10:27:59.233566
4274	production	18	2025-09-04 10:27:59.233566
4275	production	1	2025-09-04 10:27:59.233566
5298	director	1220	2025-09-17 10:01:23.588413
5299	director	1222	2025-09-17 10:01:23.603728
5300	director	1225	2025-09-17 10:01:23.613961
5301	manager	1	2025-09-17 10:01:23.623399
5302	manager	2	2025-09-17 10:01:23.63407
1393	director	362	2025-08-20 11:05:35.712304
1394	director	363	2025-08-20 11:05:35.716555
1395	director	364	2025-08-20 11:05:35.73575
1396	director	365	2025-08-20 11:05:35.740319
5303	manager	3	2025-09-17 10:01:23.643719
5304	manager	361	2025-09-17 10:01:23.661244
5305	manager	5	2025-09-17 10:01:23.670489
5306	manager	8	2025-09-17 10:01:23.68372
5307	manager	9	2025-09-17 10:01:23.692655
5308	manager	10	2025-09-17 10:01:23.702002
5309	manager	11	2025-09-17 10:01:23.714821
5310	manager	1213	2025-09-17 10:01:23.726618
3746	director	1	2025-08-29 09:19:51.612319
3747	director	2	2025-08-29 09:19:51.619024
3748	director	3	2025-08-29 09:19:51.623113
3749	director	4	2025-08-29 09:19:51.627031
1433	director	1	2025-08-22 08:13:33.913522
1434	director	2	2025-08-22 08:13:33.918005
1435	director	3	2025-08-22 08:13:33.935226
1436	director	4	2025-08-22 08:13:33.9462
1437	director	5	2025-08-22 08:13:33.960323
1438	director	6	2025-08-22 08:13:33.978709
1439	director	7	2025-08-22 08:13:33.982913
1440	director	8	2025-08-22 08:13:34.02013
1441	director	9	2025-08-22 08:13:34.036369
1442	director	10	2025-08-22 08:13:34.05314
1443	director	11	2025-08-22 08:13:34.07669
1444	director	12	2025-08-22 08:13:34.080852
1445	director	13	2025-08-22 08:13:34.090653
1446	director	14	2025-08-22 08:13:34.09944
1447	director	15	2025-08-22 08:13:34.109414
1448	director	16	2025-08-22 08:13:34.119304
1449	director	17	2025-08-22 08:13:34.138032
1450	director	18	2025-08-22 08:13:34.151299
1451	director	19	2025-08-22 08:13:34.17267
1452	director	20	2025-08-22 08:13:34.198053
1453	director	21	2025-08-22 08:13:34.219968
1454	director	22	2025-08-22 08:13:34.23762
1455	director	23	2025-08-22 08:13:34.246587
1456	director	24	2025-08-22 08:13:34.26474
1457	director	361	2025-08-22 08:13:34.296699
1458	director	362	2025-08-22 08:13:34.309454
1459	director	363	2025-08-22 08:13:34.318012
1460	director	364	2025-08-22 08:13:34.323149
1461	director	365	2025-08-22 08:13:34.330816
3750	director	5	2025-08-29 09:19:51.630149
3751	director	6	2025-08-29 09:19:51.634444
3752	director	7	2025-08-29 09:19:51.638722
3753	director	8	2025-08-29 09:19:51.645497
3754	director	9	2025-08-29 09:19:51.65019
3755	director	10	2025-08-29 09:19:51.653734
3756	director	11	2025-08-29 09:19:51.656376
3757	director	12	2025-08-29 09:19:51.663105
3758	director	13	2025-08-29 09:19:51.665798
3759	director	14	2025-08-29 09:19:51.668165
3760	director	15	2025-08-29 09:19:51.671457
3761	director	16	2025-08-29 09:19:51.674252
3762	director	17	2025-08-29 09:19:51.681107
3763	director	18	2025-08-29 09:19:51.686957
3764	director	19	2025-08-29 09:19:51.692679
3765	director	20	2025-08-29 09:19:51.695664
3766	director	21	2025-08-29 09:19:51.698228
5113	director	1	2025-09-17 08:58:53.377619
5114	director	2	2025-09-17 08:58:53.399462
5115	director	3	2025-09-17 08:58:53.407923
5116	director	4	2025-09-17 08:58:53.420691
5117	director	5	2025-09-17 08:58:53.423604
5118	director	6	2025-09-17 08:58:53.43121
5119	director	7	2025-09-17 08:58:53.435118
5120	director	8	2025-09-17 08:58:53.454572
5121	director	9	2025-09-17 08:58:53.459384
5122	director	10	2025-09-17 08:58:53.465959
5123	director	11	2025-09-17 08:58:53.468488
3767	director	22	2025-08-29 09:19:51.703776
3768	director	23	2025-08-29 09:19:51.706317
3769	director	24	2025-08-29 09:19:51.708736
3770	director	361	2025-08-29 09:19:51.711319
3771	director	362	2025-08-29 09:19:51.71336
3772	director	363	2025-08-29 09:19:51.715429
3773	director	364	2025-08-29 09:19:51.717959
3774	director	365	2025-08-29 09:19:51.720212
1498	director	1	2025-08-25 10:56:20.844996
1499	director	2	2025-08-25 10:56:20.850085
1500	director	3	2025-08-25 10:56:20.853513
1501	director	4	2025-08-25 10:56:20.856996
1502	director	5	2025-08-25 10:56:20.861851
1503	director	6	2025-08-25 10:56:20.865555
1504	director	7	2025-08-25 10:56:20.873205
1505	director	8	2025-08-25 10:56:20.877575
1506	director	9	2025-08-25 10:56:20.881409
1507	director	10	2025-08-25 10:56:20.884762
1508	director	11	2025-08-25 10:56:20.888491
1509	director	12	2025-08-25 10:56:20.891837
1510	director	13	2025-08-25 10:56:20.895561
1511	director	14	2025-08-25 10:56:20.904567
1512	director	15	2025-08-25 10:56:20.911298
1513	director	16	2025-08-25 10:56:20.916387
1514	director	17	2025-08-25 10:56:20.920283
1515	director	18	2025-08-25 10:56:20.924462
1516	director	19	2025-08-25 10:56:20.929256
1517	director	20	2025-08-25 10:56:20.933838
1518	director	21	2025-08-25 10:56:20.937442
1519	director	22	2025-08-25 10:56:20.942115
1520	director	23	2025-08-25 10:56:20.94563
1521	director	24	2025-08-25 10:56:20.949125
1522	director	361	2025-08-25 10:56:20.952386
1523	director	362	2025-08-25 10:56:20.955769
1524	director	363	2025-08-25 10:56:20.961393
1525	director	364	2025-08-25 10:56:20.964755
1526	director	365	2025-08-25 10:56:20.968114
3775	manager	1	2025-08-29 09:19:51.723377
3776	manager	2	2025-08-29 09:19:51.72585
3777	manager	3	2025-08-29 09:19:51.72832
3778	manager	361	2025-08-29 09:19:51.73094
3779	manager	5	2025-08-29 09:19:51.733111
3780	manager	8	2025-08-29 09:19:51.735285
3781	manager	9	2025-08-29 09:19:51.737434
3782	manager	10	2025-08-29 09:19:51.739737
3783	manager	11	2025-08-29 09:19:51.741963
3784	manager	362	2025-08-29 09:19:51.744079
3785	manager	12	2025-08-29 09:19:51.754279
3786	manager	15	2025-08-29 09:19:51.757034
3787	manager	16	2025-08-29 09:19:51.759615
3788	manager	18	2025-08-29 09:19:51.761942
5124	director	12	2025-09-17 08:58:53.474613
5125	director	13	2025-09-17 08:58:53.477474
5126	director	14	2025-09-17 08:58:53.494397
5127	director	15	2025-09-17 08:58:53.497812
5128	director	16	2025-09-17 08:58:53.501529
5129	director	17	2025-09-17 08:58:53.524538
5130	director	18	2025-09-17 08:58:53.536485
5131	director	19	2025-09-17 08:58:53.540377
5132	director	20	2025-09-17 08:58:53.544053
3789	manager	19	2025-08-29 09:19:51.764234
3790	manager	20	2025-08-29 09:19:51.766678
3791	manager	365	2025-08-29 09:19:51.769689
5133	director	21	2025-09-17 08:58:53.555824
5134	director	22	2025-09-17 08:58:53.55942
5135	director	23	2025-09-17 08:58:53.562438
1556	director	1	2025-08-26 12:43:08.660996
1557	director	2	2025-08-26 12:43:08.665652
1558	director	3	2025-08-26 12:43:08.669087
1559	director	4	2025-08-26 12:43:08.672383
1560	director	5	2025-08-26 12:43:08.676427
1561	director	6	2025-08-26 12:43:08.681179
1562	director	7	2025-08-26 12:43:08.685848
1563	director	8	2025-08-26 12:43:08.690438
1564	director	9	2025-08-26 12:43:08.694662
1565	director	10	2025-08-26 12:43:08.698439
1566	director	11	2025-08-26 12:43:08.702547
1567	director	12	2025-08-26 12:43:08.706416
1568	director	13	2025-08-26 12:43:08.710586
1569	director	14	2025-08-26 12:43:08.714232
1570	director	15	2025-08-26 12:43:08.720367
1571	director	16	2025-08-26 12:43:08.724253
1572	director	17	2025-08-26 12:43:08.727817
1573	director	18	2025-08-26 12:43:08.731219
1574	director	19	2025-08-26 12:43:08.734572
1575	director	20	2025-08-26 12:43:08.737994
1576	director	21	2025-08-26 12:43:08.747735
1577	director	22	2025-08-26 12:43:08.751809
1578	director	23	2025-08-26 12:43:08.75608
1579	director	24	2025-08-26 12:43:08.759991
1580	director	361	2025-08-26 12:43:08.763723
1581	director	362	2025-08-26 12:43:08.767276
1582	director	363	2025-08-26 12:43:08.770444
1583	director	364	2025-08-26 12:43:08.774005
1584	director	365	2025-08-26 12:43:08.778425
5136	director	24	2025-09-17 08:58:53.565674
5137	director	361	2025-09-17 08:58:53.569641
5138	director	362	2025-09-17 08:58:53.579852
5139	director	363	2025-09-17 08:58:53.599067
5140	director	364	2025-09-17 08:58:53.604662
5141	director	365	2025-09-17 08:58:53.611032
5142	director	1213	2025-09-17 08:58:53.616525
5143	director	1216	2025-09-17 08:58:53.620596
3803	warehouse	1	2025-08-29 09:19:51.80635
3804	warehouse	361	2025-08-29 09:19:51.808544
3805	warehouse	5	2025-08-29 09:19:51.810741
3806	warehouse	6	2025-08-29 09:19:51.813297
3807	warehouse	8	2025-08-29 09:19:51.815813
3808	warehouse	18	2025-08-29 09:19:51.818281
3809	warehouse	20	2025-08-29 09:19:51.821113
3810	warehouse	365	2025-08-29 09:19:51.823583
4071	director	1	2025-09-02 19:15:16.51085
5144	director	1220	2025-09-17 08:58:53.625
5145	director	1222	2025-09-17 08:58:53.627996
5146	director	1225	2025-09-17 08:58:53.632027
5147	manager	1	2025-09-17 08:58:53.63734
5148	manager	2	2025-09-17 08:58:53.643422
5149	manager	3	2025-09-17 08:58:53.647433
5150	manager	361	2025-09-17 08:58:53.655614
5151	manager	5	2025-09-17 08:58:53.659969
5152	manager	8	2025-09-17 08:58:53.666824
5153	manager	9	2025-09-17 08:58:53.676585
5154	manager	10	2025-09-17 08:58:53.683014
4072	director	2	2025-09-02 19:15:16.517381
4073	director	3	2025-09-02 19:15:16.521283
4074	director	4	2025-09-02 19:15:16.523873
4075	director	5	2025-09-02 19:15:16.52702
4076	director	6	2025-09-02 19:15:16.532858
4077	director	7	2025-09-02 19:15:16.535662
4078	director	8	2025-09-02 19:15:16.543878
4079	director	9	2025-09-02 19:15:16.547654
1621	warehouse	1	2025-08-27 13:04:56.729894
1622	warehouse	5	2025-08-27 13:04:56.729894
1623	warehouse	6	2025-08-27 13:04:56.729894
1624	warehouse	18	2025-08-27 13:04:56.729894
1625	warehouse	20	2025-08-27 13:04:56.729894
1626	warehouse	15	2025-08-27 13:04:56.729894
1627	warehouse	12	2025-08-27 13:04:56.729894
1628	warehouse	7	2025-08-27 13:04:56.729894
1629	warehouse	2	2025-08-27 13:04:56.729894
1630	warehouse	3	2025-08-27 13:04:56.729894
1631	warehouse	361	2025-08-27 13:04:56.729894
1632	warehouse	8	2025-08-27 13:04:56.729894
1633	warehouse	365	2025-08-27 13:04:56.729894
1634	warehouse	1	2025-08-27 13:04:56.729894
1635	warehouse	361	2025-08-27 13:04:56.729894
1636	warehouse	5	2025-08-27 13:04:56.729894
1637	warehouse	6	2025-08-27 13:04:56.729894
1638	warehouse	8	2025-08-27 13:04:56.729894
1639	warehouse	18	2025-08-27 13:04:56.729894
1640	warehouse	20	2025-08-27 13:04:56.729894
1641	warehouse	365	2025-08-27 13:04:56.729894
1642	warehouse	1	2025-08-27 13:04:56.729894
1643	warehouse	361	2025-08-27 13:04:56.729894
1644	warehouse	5	2025-08-27 13:04:56.729894
1645	warehouse	6	2025-08-27 13:04:56.729894
1646	warehouse	8	2025-08-27 13:04:56.729894
1647	warehouse	18	2025-08-27 13:04:56.729894
1648	warehouse	20	2025-08-27 13:04:56.729894
1649	warehouse	365	2025-08-27 13:04:56.729894
1650	warehouse	1	2025-08-27 13:04:56.729894
1651	warehouse	5	2025-08-27 13:04:56.729894
1652	warehouse	6	2025-08-27 13:04:56.729894
1653	warehouse	8	2025-08-27 13:04:56.729894
1654	warehouse	18	2025-08-27 13:04:56.729894
1655	warehouse	20	2025-08-27 13:04:56.729894
1656	warehouse	1	2025-08-27 13:04:56.729894
1657	warehouse	361	2025-08-27 13:04:56.729894
1658	warehouse	5	2025-08-27 13:04:56.729894
1659	warehouse	6	2025-08-27 13:04:56.729894
1660	warehouse	8	2025-08-27 13:04:56.729894
1661	warehouse	18	2025-08-27 13:04:56.729894
1662	warehouse	20	2025-08-27 13:04:56.729894
1663	warehouse	365	2025-08-27 13:04:56.729894
1664	warehouse	4	2025-08-27 13:04:56.729894
1665	director	1	2025-08-27 13:48:23.273554
1666	director	2	2025-08-27 13:48:23.278075
1667	director	3	2025-08-27 13:48:23.281625
1668	director	4	2025-08-27 13:48:23.286998
1669	director	5	2025-08-27 13:48:23.291012
1670	director	6	2025-08-27 13:48:23.29568
1671	director	7	2025-08-27 13:48:23.304398
1672	director	8	2025-08-27 13:48:23.307561
1673	director	9	2025-08-27 13:48:23.310597
1674	director	10	2025-08-27 13:48:23.313282
1675	director	11	2025-08-27 13:48:23.315723
1676	director	12	2025-08-27 13:48:23.31826
1677	director	13	2025-08-27 13:48:23.321779
1678	director	14	2025-08-27 13:48:23.325691
1679	director	15	2025-08-27 13:48:23.328484
1680	director	16	2025-08-27 13:48:23.331206
1681	director	17	2025-08-27 13:48:23.334103
1682	director	18	2025-08-27 13:48:23.337098
1683	director	19	2025-08-27 13:48:23.33977
1684	director	20	2025-08-27 13:48:23.342595
1685	director	21	2025-08-27 13:48:23.34514
1686	director	22	2025-08-27 13:48:23.353318
1687	director	23	2025-08-27 13:48:23.35623
1688	director	24	2025-08-27 13:48:23.359685
1689	director	361	2025-08-27 13:48:23.363762
1690	director	362	2025-08-27 13:48:23.367166
1691	director	363	2025-08-27 13:48:23.369875
1692	director	364	2025-08-27 13:48:23.372703
1693	director	365	2025-08-27 13:48:23.375781
4080	director	10	2025-09-02 19:15:16.550324
4081	director	11	2025-09-02 19:15:16.553472
4082	director	12	2025-09-02 19:15:16.557259
4083	director	13	2025-09-02 19:15:16.562216
4084	director	14	2025-09-02 19:15:16.566401
4085	director	15	2025-09-02 19:15:16.569868
4086	director	16	2025-09-02 19:15:16.572582
4087	director	17	2025-09-02 19:15:16.575239
4088	director	18	2025-09-02 19:15:16.578395
4089	director	19	2025-09-02 19:15:16.5874
4090	director	20	2025-09-02 19:15:16.592103
4091	director	21	2025-09-02 19:15:16.596528
4092	director	22	2025-09-02 19:15:16.600043
4093	director	23	2025-09-02 19:15:16.603599
4094	director	24	2025-09-02 19:15:16.607957
4095	director	361	2025-09-02 19:15:16.611274
4096	director	362	2025-09-02 19:15:16.614864
5155	manager	11	2025-09-17 08:58:53.689213
5156	manager	1213	2025-09-17 08:58:53.694345
5157	manager	362	2025-09-17 08:58:53.701892
5158	manager	12	2025-09-17 08:58:53.70673
5159	manager	1216	2025-09-17 08:58:53.715596
5160	manager	15	2025-09-17 08:58:53.719386
5161	manager	16	2025-09-17 08:58:53.726433
5162	manager	1222	2025-09-17 08:58:53.729618
5163	manager	18	2025-09-17 08:58:53.733365
5164	manager	19	2025-09-17 08:58:53.737507
5165	manager	1225	2025-09-17 08:58:53.741394
1722	warehouse	1	2025-08-27 13:48:23.471008
1723	warehouse	361	2025-08-27 13:48:23.474378
1724	warehouse	5	2025-08-27 13:48:23.47746
1725	warehouse	6	2025-08-27 13:48:23.481073
1726	warehouse	8	2025-08-27 13:48:23.484672
1727	warehouse	18	2025-08-27 13:48:23.487972
1728	warehouse	20	2025-08-27 13:48:23.49166
1729	warehouse	365	2025-08-27 13:48:23.495063
1730	director	1	2025-08-27 13:59:09.752054
1731	director	2	2025-08-27 13:59:09.757091
1732	director	3	2025-08-27 13:59:09.759999
1733	director	4	2025-08-27 13:59:09.763571
1734	director	5	2025-08-27 13:59:09.766477
1735	director	6	2025-08-27 13:59:09.770373
1736	director	7	2025-08-27 13:59:09.772902
1737	director	8	2025-08-27 13:59:09.775964
1738	director	9	2025-08-27 13:59:09.780556
1739	director	10	2025-08-27 13:59:09.784966
1740	director	11	2025-08-27 13:59:09.791548
1741	director	12	2025-08-27 13:59:09.796
1742	director	13	2025-08-27 13:59:09.799338
1743	director	14	2025-08-27 13:59:09.802238
1744	director	15	2025-08-27 13:59:09.805343
1745	director	16	2025-08-27 13:59:09.809394
1746	director	17	2025-08-27 13:59:09.81255
1747	director	18	2025-08-27 13:59:09.815065
1748	director	19	2025-08-27 13:59:09.817511
1749	director	20	2025-08-27 13:59:09.820626
1750	director	21	2025-08-27 13:59:09.82485
1751	director	22	2025-08-27 13:59:09.829363
1752	director	23	2025-08-27 13:59:09.83222
1753	director	24	2025-08-27 13:59:09.836112
1754	director	361	2025-08-27 13:59:09.839332
1755	director	362	2025-08-27 13:59:09.842585
1756	director	363	2025-08-27 13:59:09.845764
1757	director	364	2025-08-27 13:59:09.848753
1758	director	365	2025-08-27 13:59:09.852943
3811	director	1	2025-08-29 09:22:07.776002
3812	director	2	2025-08-29 09:22:07.780534
3813	director	3	2025-08-29 09:22:07.784252
3814	director	4	2025-08-29 09:22:07.788142
3815	director	5	2025-08-29 09:22:07.79283
3816	director	6	2025-08-29 09:22:07.796028
3817	director	7	2025-08-29 09:22:07.799614
3818	director	8	2025-08-29 09:22:07.803208
3819	director	9	2025-08-29 09:22:07.8081
3820	director	10	2025-08-29 09:22:07.815276
3821	director	11	2025-08-29 09:22:07.824429
3822	director	12	2025-08-29 09:22:07.827628
3823	director	13	2025-08-29 09:22:07.830402
3824	director	14	2025-08-29 09:22:07.833717
3825	director	15	2025-08-29 09:22:07.836848
3826	director	16	2025-08-29 09:22:07.839824
3827	director	17	2025-08-29 09:22:07.84283
5166	manager	20	2025-09-17 08:58:53.746523
5167	manager	365	2025-09-17 08:58:53.749617
5168	manager	21	2025-09-17 08:58:53.755341
5169	production	1	2025-09-17 08:58:53.758281
5170	production	5	2025-09-17 08:58:53.762444
5171	production	8	2025-09-17 08:58:53.766721
5172	production	12	2025-09-17 08:58:53.772062
5173	production	13	2025-09-17 08:58:53.776012
5174	production	1216	2025-09-17 08:58:53.779141
5175	production	14	2025-09-17 08:58:53.782166
5176	production	363	2025-09-17 08:58:53.786196
1787	warehouse	1	2025-08-27 13:59:09.945419
1788	warehouse	361	2025-08-27 13:59:09.94853
1789	warehouse	5	2025-08-27 13:59:09.951406
1790	warehouse	6	2025-08-27 13:59:09.954095
1791	warehouse	8	2025-08-27 13:59:09.956754
1792	warehouse	18	2025-08-27 13:59:09.959419
1793	warehouse	20	2025-08-27 13:59:09.962269
1794	warehouse	365	2025-08-27 13:59:09.96475
3828	director	18	2025-08-29 09:22:07.845952
3829	director	19	2025-08-29 09:22:07.850822
3830	director	20	2025-08-29 09:22:07.85371
3831	director	21	2025-08-29 09:22:07.856416
3832	director	22	2025-08-29 09:22:07.859443
3833	director	23	2025-08-29 09:22:07.861834
3834	director	24	2025-08-29 09:22:07.864465
3835	director	361	2025-08-29 09:22:07.867901
3836	director	362	2025-08-29 09:22:07.870982
3837	director	363	2025-08-29 09:22:07.873886
3838	director	364	2025-08-29 09:22:07.87731
3839	director	365	2025-08-29 09:22:07.88095
3840	manager	1	2025-08-29 09:22:07.884555
3841	manager	2	2025-08-29 09:22:07.888232
3842	manager	3	2025-08-29 09:22:07.89239
3843	manager	361	2025-08-29 09:22:07.89562
3844	manager	5	2025-08-29 09:22:07.899703
3845	manager	8	2025-08-29 09:22:07.902768
3846	manager	9	2025-08-29 09:22:07.909197
3847	manager	10	2025-08-29 09:22:07.913413
3848	manager	11	2025-08-29 09:22:07.917564
3849	manager	362	2025-08-29 09:22:07.921076
3850	manager	12	2025-08-29 09:22:07.924438
3851	manager	15	2025-08-29 09:22:07.927518
3852	manager	16	2025-08-29 09:22:07.930258
3853	manager	18	2025-08-29 09:22:07.932621
3854	manager	19	2025-08-29 09:22:07.93501
3855	manager	20	2025-08-29 09:22:07.937452
3856	manager	365	2025-08-29 09:22:07.93985
5177	production	15	2025-09-17 08:58:53.793336
5178	production	17	2025-09-17 08:58:53.796559
5179	production	1222	2025-09-17 08:58:53.815301
5180	production	364	2025-09-17 08:58:53.820384
5181	production	18	2025-09-17 08:58:53.826081
5182	warehouse	1	2025-09-17 08:58:53.83501
5183	warehouse	361	2025-09-17 08:58:53.838841
5184	warehouse	5	2025-09-17 08:58:53.844918
5185	warehouse	6	2025-09-17 08:58:53.848925
5186	warehouse	8	2025-09-17 08:58:53.854115
5187	warehouse	18	2025-09-17 08:58:53.859061
3868	warehouse	1	2025-08-29 09:22:07.977511
3869	warehouse	361	2025-08-29 09:22:07.981347
3870	warehouse	5	2025-08-29 09:22:07.98503
3871	warehouse	6	2025-08-29 09:22:07.988537
3872	warehouse	8	2025-08-29 09:22:07.991728
3873	warehouse	18	2025-08-29 09:22:07.994574
3874	warehouse	20	2025-08-29 09:22:07.997547
3875	warehouse	365	2025-08-29 09:22:08.000998
4097	director	363	2025-09-02 19:15:16.618227
4098	director	364	2025-09-02 19:15:16.622549
4099	director	365	2025-09-02 19:15:16.625955
4100	manager	1	2025-09-02 19:15:16.629622
4101	manager	2	2025-09-02 19:15:16.632616
4102	manager	3	2025-09-02 19:15:16.63721
4103	manager	361	2025-09-02 19:15:16.641717
4104	manager	5	2025-09-02 19:15:16.64572
4105	manager	8	2025-09-02 19:15:16.648524
4106	manager	9	2025-09-02 19:15:16.651994
4107	manager	10	2025-09-02 19:15:16.655329
4108	manager	11	2025-09-02 19:15:16.658441
4109	manager	362	2025-09-02 19:15:16.662985
4110	manager	12	2025-09-02 19:15:16.667024
4111	manager	15	2025-09-02 19:15:16.670027
4112	manager	16	2025-09-02 19:15:16.673964
4113	manager	18	2025-09-02 19:15:16.677785
4114	manager	19	2025-09-02 19:15:16.681495
4115	manager	20	2025-09-02 19:15:16.684929
4116	manager	365	2025-09-02 19:15:16.688922
5188	warehouse	20	2025-09-17 08:58:53.863505
5189	warehouse	365	2025-09-17 08:58:53.866934
5311	manager	362	2025-09-17 10:01:23.741812
5312	manager	12	2025-09-17 10:01:23.751492
5313	manager	1216	2025-09-17 10:01:23.760607
5314	manager	15	2025-09-17 10:01:23.778426
5315	manager	16	2025-09-17 10:01:23.79843
5316	manager	1222	2025-09-17 10:01:23.814137
5317	manager	18	2025-09-17 10:01:23.830089
5318	manager	19	2025-09-17 10:01:23.842314
5319	manager	1225	2025-09-17 10:01:23.851499
4128	warehouse	1	2025-09-02 19:15:16.726106
4129	warehouse	361	2025-09-02 19:15:16.729054
4130	warehouse	5	2025-09-02 19:15:16.731461
4131	warehouse	6	2025-09-02 19:15:16.735231
4132	warehouse	8	2025-09-02 19:15:16.738563
4133	warehouse	18	2025-09-02 19:15:16.742778
4134	warehouse	20	2025-09-02 19:15:16.745836
4135	warehouse	365	2025-09-02 19:15:16.749082
4276	production	5	2025-09-04 10:27:59.233566
4277	production	8	2025-09-04 10:27:59.233566
4278	production	12	2025-09-04 10:27:59.233566
4279	production	13	2025-09-04 10:27:59.233566
4280	production	14	2025-09-04 10:27:59.233566
4281	production	15	2025-09-04 10:27:59.233566
4282	production	17	2025-09-04 10:27:59.233566
4283	production	18	2025-09-04 10:27:59.233566
4284	production	1	2025-09-04 10:27:59.233566
4285	production	5	2025-09-04 10:27:59.233566
4286	production	8	2025-09-04 10:27:59.233566
4287	production	12	2025-09-04 10:27:59.233566
4288	production	13	2025-09-04 10:27:59.233566
4289	production	14	2025-09-04 10:27:59.233566
4290	production	15	2025-09-04 10:27:59.233566
4291	production	17	2025-09-04 10:27:59.233566
4292	production	18	2025-09-04 10:27:59.233566
4293	production	1	2025-09-04 10:27:59.233566
3876	director	1	2025-08-29 09:25:49.622389
3877	director	2	2025-08-29 09:25:49.625914
3878	director	3	2025-08-29 09:25:49.628507
3879	director	4	2025-08-29 09:25:49.631397
3880	director	5	2025-08-29 09:25:49.634634
3881	director	6	2025-08-29 09:25:49.63745
3882	director	7	2025-08-29 09:25:49.640118
3883	director	8	2025-08-29 09:25:49.642563
3884	director	9	2025-08-29 09:25:49.645035
3885	director	10	2025-08-29 09:25:49.647249
3886	director	11	2025-08-29 09:25:49.649369
3887	director	12	2025-08-29 09:25:49.651509
3888	director	13	2025-08-29 09:25:49.653697
3889	director	14	2025-08-29 09:25:49.656084
3890	director	15	2025-08-29 09:25:49.658296
3891	director	16	2025-08-29 09:25:49.660377
3892	director	17	2025-08-29 09:25:49.662707
3893	director	18	2025-08-29 09:25:49.665055
3894	director	19	2025-08-29 09:25:49.667368
3895	director	20	2025-08-29 09:25:49.669485
3896	director	21	2025-08-29 09:25:49.671705
3897	director	22	2025-08-29 09:25:49.67396
3898	director	23	2025-08-29 09:25:49.6767
3899	director	24	2025-08-29 09:25:49.679594
3900	director	361	2025-08-29 09:25:49.682843
3901	director	362	2025-08-29 09:25:49.685802
3902	director	363	2025-08-29 09:25:49.689118
3903	director	364	2025-08-29 09:25:49.692018
3904	director	365	2025-08-29 09:25:49.695352
3905	manager	1	2025-08-29 09:25:49.698372
3906	manager	2	2025-08-29 09:25:49.700582
3907	manager	3	2025-08-29 09:25:49.704937
3908	manager	361	2025-08-29 09:25:49.707201
3909	manager	5	2025-08-29 09:25:49.709456
3910	manager	8	2025-08-29 09:25:49.712022
3911	manager	9	2025-08-29 09:25:49.715108
3912	manager	10	2025-08-29 09:25:49.717731
3913	manager	11	2025-08-29 09:25:49.720367
3914	manager	362	2025-08-29 09:25:49.722706
3915	manager	12	2025-08-29 09:25:49.725237
3916	manager	15	2025-08-29 09:25:49.727688
3917	manager	16	2025-08-29 09:25:49.730843
3918	manager	18	2025-08-29 09:25:49.733286
3919	manager	19	2025-08-29 09:25:49.735784
3920	manager	20	2025-08-29 09:25:49.73823
3921	manager	365	2025-08-29 09:25:49.740487
5190	director	1	2025-09-17 09:44:09.965814
5191	director	2	2025-09-17 09:44:10.057408
5192	director	3	2025-09-17 09:44:10.10913
5193	director	4	2025-09-17 09:44:10.172457
5194	director	5	2025-09-17 09:44:10.195174
5195	director	6	2025-09-17 09:44:10.208446
5196	director	7	2025-09-17 09:44:10.237785
5197	director	8	2025-09-17 09:44:10.274897
5198	director	9	2025-09-17 09:44:10.323587
5199	director	10	2025-09-17 09:44:10.371711
5200	director	11	2025-09-17 09:44:10.385343
3933	warehouse	1	2025-08-29 09:25:49.771125
3934	warehouse	361	2025-08-29 09:25:49.774248
3935	warehouse	5	2025-08-29 09:25:49.777288
3936	warehouse	6	2025-08-29 09:25:49.780427
3937	warehouse	8	2025-08-29 09:25:49.783273
3938	warehouse	18	2025-08-29 09:25:49.787431
3939	warehouse	20	2025-08-29 09:25:49.791139
3940	warehouse	365	2025-08-29 09:25:49.794102
4136	director	1	2025-09-02 19:23:40.80002
4137	director	2	2025-09-02 19:23:40.80984
4138	director	3	2025-09-02 19:23:40.814902
4139	director	4	2025-09-02 19:23:40.818767
4140	director	5	2025-09-02 19:23:40.824819
4141	director	6	2025-09-02 19:23:40.8282
4142	director	7	2025-09-02 19:23:40.83453
4143	director	8	2025-09-02 19:23:40.840764
4144	director	9	2025-09-02 19:23:40.844779
4145	director	10	2025-09-02 19:23:40.849406
4146	director	11	2025-09-02 19:23:40.854043
4147	director	12	2025-09-02 19:23:40.858996
4148	director	13	2025-09-02 19:23:40.863571
4149	director	14	2025-09-02 19:23:40.871177
4150	director	15	2025-09-02 19:23:40.875677
4151	director	16	2025-09-02 19:23:40.88347
4152	director	17	2025-09-02 19:23:40.890599
4153	director	18	2025-09-02 19:23:40.894769
4154	director	19	2025-09-02 19:23:40.902218
4155	director	20	2025-09-02 19:23:40.908798
4156	director	21	2025-09-02 19:23:40.912057
4157	director	22	2025-09-02 19:23:40.922856
4158	director	23	2025-09-02 19:23:40.927421
4159	director	24	2025-09-02 19:23:40.932123
4160	director	361	2025-09-02 19:23:40.936385
4161	director	362	2025-09-02 19:23:40.940721
4162	director	363	2025-09-02 19:23:40.949297
4163	director	364	2025-09-02 19:23:40.953842
4164	director	365	2025-09-02 19:23:40.95761
4165	manager	1	2025-09-02 19:23:40.961352
4166	manager	2	2025-09-02 19:23:40.965161
4167	manager	3	2025-09-02 19:23:40.969996
4168	manager	361	2025-09-02 19:23:40.972531
4169	manager	5	2025-09-02 19:23:40.980445
4170	manager	8	2025-09-02 19:23:40.984571
4171	manager	9	2025-09-02 19:23:40.988936
4172	manager	10	2025-09-02 19:23:40.994184
4173	manager	11	2025-09-02 19:23:40.999625
4174	manager	362	2025-09-02 19:23:41.004068
4175	manager	12	2025-09-02 19:23:41.008096
4176	manager	15	2025-09-02 19:23:41.011912
4177	manager	16	2025-09-02 19:23:41.016902
4178	manager	18	2025-09-02 19:23:41.022848
4179	manager	19	2025-09-02 19:23:41.026677
4180	manager	20	2025-09-02 19:23:41.031076
4181	manager	365	2025-09-02 19:23:41.03591
5201	director	12	2025-09-17 09:44:10.427804
5202	director	13	2025-09-17 09:44:10.469683
5203	director	14	2025-09-17 09:44:10.497863
5204	director	15	2025-09-17 09:44:10.518422
5205	director	16	2025-09-17 09:44:10.549798
5206	director	17	2025-09-17 09:44:10.670582
5207	director	18	2025-09-17 09:44:10.728698
5208	director	19	2025-09-17 09:44:10.777513
5209	director	20	2025-09-17 09:44:10.801701
5210	director	21	2025-09-17 09:44:10.833484
5211	director	22	2025-09-17 09:44:10.869113
4193	warehouse	1	2025-09-02 19:23:41.080257
4194	warehouse	361	2025-09-02 19:23:41.08387
4195	warehouse	5	2025-09-02 19:23:41.090198
4196	warehouse	6	2025-09-02 19:23:41.093726
4197	warehouse	8	2025-09-02 19:23:41.104519
4198	warehouse	18	2025-09-02 19:23:41.108539
4199	warehouse	20	2025-09-02 19:23:41.11255
4200	warehouse	365	2025-09-02 19:23:41.115902
4294	production	5	2025-09-04 10:27:59.233566
4295	production	8	2025-09-04 10:27:59.233566
4296	production	12	2025-09-04 10:27:59.233566
4297	production	13	2025-09-04 10:27:59.233566
4298	production	14	2025-09-04 10:27:59.233566
4299	production	363	2025-09-04 10:27:59.233566
4300	production	15	2025-09-04 10:27:59.233566
4301	production	17	2025-09-04 10:27:59.233566
4302	production	364	2025-09-04 10:27:59.233566
4303	production	1	2025-09-04 10:27:59.233566
4304	production	5	2025-09-04 10:27:59.233566
4305	production	8	2025-09-04 10:27:59.233566
4306	production	12	2025-09-04 10:27:59.233566
4307	production	13	2025-09-04 10:27:59.233566
4308	production	14	2025-09-04 10:27:59.233566
4309	production	15	2025-09-04 10:27:59.233566
4310	production	17	2025-09-04 10:27:59.233566
4311	production	18	2025-09-04 10:27:59.233566
4312	production	18	2025-09-04 10:27:59.233566
4313	production	1	2025-09-04 10:27:59.233566
4314	production	5	2025-09-04 10:27:59.233566
4315	production	8	2025-09-04 10:27:59.233566
4316	production	12	2025-09-04 10:27:59.233566
4317	production	13	2025-09-04 10:27:59.233566
4318	production	14	2025-09-04 10:27:59.233566
4319	production	15	2025-09-04 10:27:59.233566
4320	production	17	2025-09-04 10:27:59.233566
3941	director	1	2025-08-29 11:40:31.289876
3942	director	2	2025-08-29 11:40:31.294316
3943	director	3	2025-08-29 11:40:31.299604
3944	director	4	2025-08-29 11:40:31.305883
3945	director	5	2025-08-29 11:40:31.309962
3946	director	6	2025-08-29 11:40:31.313178
3947	director	7	2025-08-29 11:40:31.316368
3948	director	8	2025-08-29 11:40:31.319378
3949	director	9	2025-08-29 11:40:31.321818
3950	director	10	2025-08-29 11:40:31.324559
3951	director	11	2025-08-29 11:40:31.327045
3952	director	12	2025-08-29 11:40:31.329928
3953	director	13	2025-08-29 11:40:31.332126
3954	director	14	2025-08-29 11:40:31.334875
3955	director	15	2025-08-29 11:40:31.338597
3956	director	16	2025-08-29 11:40:31.341598
3957	director	17	2025-08-29 11:40:31.344858
3958	director	18	2025-08-29 11:40:31.34833
3959	director	19	2025-08-29 11:40:31.351302
3960	director	20	2025-08-29 11:40:31.353831
3961	director	21	2025-08-29 11:40:31.35626
3962	director	22	2025-08-29 11:40:31.360158
3963	director	23	2025-08-29 11:40:31.362783
3964	director	24	2025-08-29 11:40:31.36522
3965	director	361	2025-08-29 11:40:31.367965
3388	manager	1	2025-08-28 08:43:16.414936
3389	manager	5	2025-08-28 08:43:16.414936
3390	manager	8	2025-08-28 08:43:16.414936
3391	manager	9	2025-08-28 08:43:16.414936
3392	manager	10	2025-08-28 08:43:16.414936
3393	manager	12	2025-08-28 08:43:16.414936
3394	manager	15	2025-08-28 08:43:16.414936
3395	manager	18	2025-08-28 08:43:16.414936
3396	manager	1	2025-08-28 08:43:16.414936
3397	manager	5	2025-08-28 08:43:16.414936
3398	manager	8	2025-08-28 08:43:16.414936
3399	manager	9	2025-08-28 08:43:16.414936
3400	manager	10	2025-08-28 08:43:16.414936
3401	manager	12	2025-08-28 08:43:16.414936
3402	manager	15	2025-08-28 08:43:16.414936
3403	manager	18	2025-08-28 08:43:16.414936
3404	manager	1	2025-08-28 08:43:16.414936
3405	manager	5	2025-08-28 08:43:16.414936
3406	manager	8	2025-08-28 08:43:16.414936
3407	manager	9	2025-08-28 08:43:16.414936
3408	manager	10	2025-08-28 08:43:16.414936
3409	manager	12	2025-08-28 08:43:16.414936
3410	manager	15	2025-08-28 08:43:16.414936
3411	manager	18	2025-08-28 08:43:16.414936
3412	manager	1	2025-08-28 08:43:16.414936
3413	manager	5	2025-08-28 08:43:16.414936
3414	manager	8	2025-08-28 08:43:16.414936
3415	manager	9	2025-08-28 08:43:16.414936
3416	manager	10	2025-08-28 08:43:16.414936
3417	manager	12	2025-08-28 08:43:16.414936
3418	manager	15	2025-08-28 08:43:16.414936
3419	manager	18	2025-08-28 08:43:16.414936
3420	manager	1	2025-08-28 08:43:16.414936
3421	manager	5	2025-08-28 08:43:16.414936
3422	manager	8	2025-08-28 08:43:16.414936
3423	manager	9	2025-08-28 08:43:16.414936
3424	manager	10	2025-08-28 08:43:16.414936
3425	manager	12	2025-08-28 08:43:16.414936
3426	manager	15	2025-08-28 08:43:16.414936
3427	manager	18	2025-08-28 08:43:16.414936
3428	manager	1	2025-08-28 08:43:16.414936
3429	manager	1	2025-08-28 08:43:16.414936
3430	manager	5	2025-08-28 08:43:16.414936
3431	manager	8	2025-08-28 08:43:16.414936
3432	manager	9	2025-08-28 08:43:16.414936
3433	manager	10	2025-08-28 08:43:16.414936
3434	manager	12	2025-08-28 08:43:16.414936
3435	manager	15	2025-08-28 08:43:16.414936
3436	manager	18	2025-08-28 08:43:16.414936
3437	manager	361	2025-08-28 08:43:16.414936
3438	manager	5	2025-08-28 08:43:16.414936
3439	manager	8	2025-08-28 08:43:16.414936
3440	manager	9	2025-08-28 08:43:16.414936
3441	manager	1	2025-08-28 08:43:16.414936
3442	manager	5	2025-08-28 08:43:16.414936
3443	manager	8	2025-08-28 08:43:16.414936
3444	manager	9	2025-08-28 08:43:16.414936
3445	manager	10	2025-08-28 08:43:16.414936
3446	manager	12	2025-08-28 08:43:16.414936
3447	manager	15	2025-08-28 08:43:16.414936
3448	manager	18	2025-08-28 08:43:16.414936
3449	manager	10	2025-08-28 08:43:16.414936
3450	manager	1	2025-08-28 08:43:16.414936
3451	manager	361	2025-08-28 08:43:16.414936
3452	manager	5	2025-08-28 08:43:16.414936
3453	manager	8	2025-08-28 08:43:16.414936
3454	manager	9	2025-08-28 08:43:16.414936
3455	manager	10	2025-08-28 08:43:16.414936
3456	manager	12	2025-08-28 08:43:16.414936
3457	manager	15	2025-08-28 08:43:16.414936
3458	manager	18	2025-08-28 08:43:16.414936
3459	manager	12	2025-08-28 08:43:16.414936
3460	manager	15	2025-08-28 08:43:16.414936
3461	manager	18	2025-08-28 08:43:16.414936
3462	manager	1	2025-08-28 08:43:16.414936
3463	manager	361	2025-08-28 08:43:16.414936
3464	manager	5	2025-08-28 08:43:16.414936
3465	manager	8	2025-08-28 08:43:16.414936
3466	manager	9	2025-08-28 08:43:16.414936
3467	manager	10	2025-08-28 08:43:16.414936
3468	manager	12	2025-08-28 08:43:16.414936
3469	manager	15	2025-08-28 08:43:16.414936
3470	manager	18	2025-08-28 08:43:16.414936
3471	manager	1	2025-08-28 08:43:16.414936
3472	manager	361	2025-08-28 08:43:16.414936
3473	manager	5	2025-08-28 08:43:16.414936
3474	manager	8	2025-08-28 08:43:16.414936
3475	manager	9	2025-08-28 08:43:16.414936
3476	manager	10	2025-08-28 08:43:16.414936
3477	manager	12	2025-08-28 08:43:16.414936
3478	manager	15	2025-08-28 08:43:16.414936
3479	manager	18	2025-08-28 08:43:16.414936
3480	manager	1	2025-08-28 08:43:16.414936
3481	manager	361	2025-08-28 08:43:16.414936
3482	manager	5	2025-08-28 08:43:16.414936
3483	manager	8	2025-08-28 08:43:16.414936
3484	manager	9	2025-08-28 08:43:16.414936
3485	manager	10	2025-08-28 08:43:16.414936
3486	manager	12	2025-08-28 08:43:16.414936
3487	manager	15	2025-08-28 08:43:16.414936
3488	manager	18	2025-08-28 08:43:16.414936
3489	manager	1	2025-08-28 08:43:16.414936
3490	manager	361	2025-08-28 08:43:16.414936
3491	manager	5	2025-08-28 08:43:16.414936
3492	manager	8	2025-08-28 08:43:16.414936
3493	manager	9	2025-08-28 08:43:16.414936
3494	manager	10	2025-08-28 08:43:16.414936
3495	manager	12	2025-08-28 08:43:16.414936
3496	manager	15	2025-08-28 08:43:16.414936
3497	manager	18	2025-08-28 08:43:16.414936
3498	manager	1	2025-08-28 08:43:16.414936
3499	manager	361	2025-08-28 08:43:16.414936
3500	manager	5	2025-08-28 08:43:16.414936
3501	manager	8	2025-08-28 08:43:16.414936
3502	manager	9	2025-08-28 08:43:16.414936
3503	manager	10	2025-08-28 08:43:16.414936
3504	manager	12	2025-08-28 08:43:16.414936
3505	manager	15	2025-08-28 08:43:16.414936
3506	manager	18	2025-08-28 08:43:16.414936
3507	manager	1	2025-08-28 08:43:16.414936
3508	manager	361	2025-08-28 08:43:16.414936
3509	manager	5	2025-08-28 08:43:16.414936
3510	manager	8	2025-08-28 08:43:16.414936
3511	manager	9	2025-08-28 08:43:16.414936
3512	manager	10	2025-08-28 08:43:16.414936
3513	manager	12	2025-08-28 08:43:16.414936
3514	manager	15	2025-08-28 08:43:16.414936
3515	manager	18	2025-08-28 08:43:16.414936
3516	manager	1	2025-08-28 08:43:16.414936
3517	manager	5	2025-08-28 08:43:16.414936
3518	manager	8	2025-08-28 08:43:16.414936
3519	manager	9	2025-08-28 08:43:16.414936
3520	manager	10	2025-08-28 08:43:16.414936
3521	manager	12	2025-08-28 08:43:16.414936
3522	manager	15	2025-08-28 08:43:16.414936
3523	manager	18	2025-08-28 08:43:16.414936
3524	manager	1	2025-08-28 08:43:16.414936
3525	manager	361	2025-08-28 08:43:16.414936
3526	manager	5	2025-08-28 08:43:16.414936
3527	manager	8	2025-08-28 08:43:16.414936
3528	manager	9	2025-08-28 08:43:16.414936
3529	manager	10	2025-08-28 08:43:16.414936
3530	manager	12	2025-08-28 08:43:16.414936
3531	manager	15	2025-08-28 08:43:16.414936
3532	manager	18	2025-08-28 08:43:16.414936
3533	manager	1	2025-08-28 08:43:16.414936
3534	manager	361	2025-08-28 08:43:16.414936
3535	manager	5	2025-08-28 08:43:16.414936
3536	manager	8	2025-08-28 08:43:16.414936
3537	manager	9	2025-08-28 08:43:16.414936
3538	manager	10	2025-08-28 08:43:16.414936
3539	manager	12	2025-08-28 08:43:16.414936
3540	manager	15	2025-08-28 08:43:16.414936
3541	manager	18	2025-08-28 08:43:16.414936
3542	manager	1	2025-08-28 08:43:16.414936
3543	manager	361	2025-08-28 08:43:16.414936
3544	manager	5	2025-08-28 08:43:16.414936
3545	manager	8	2025-08-28 08:43:16.414936
3546	manager	9	2025-08-28 08:43:16.414936
3547	manager	10	2025-08-28 08:43:16.414936
3548	manager	12	2025-08-28 08:43:16.414936
3549	manager	15	2025-08-28 08:43:16.414936
3550	manager	18	2025-08-28 08:43:16.414936
3966	director	362	2025-08-29 11:40:31.371935
3967	director	363	2025-08-29 11:40:31.374976
3968	director	364	2025-08-29 11:40:31.377663
3969	director	365	2025-08-29 11:40:31.381061
3970	manager	1	2025-08-29 11:40:31.384913
3971	manager	2	2025-08-29 11:40:31.389046
3972	manager	3	2025-08-29 11:40:31.393031
3973	manager	361	2025-08-29 11:40:31.397033
3974	manager	5	2025-08-29 11:40:31.40055
3975	manager	8	2025-08-29 11:40:31.403656
3976	manager	9	2025-08-29 11:40:31.406708
3977	manager	10	2025-08-29 11:40:31.409939
3978	manager	11	2025-08-29 11:40:31.413288
3979	manager	362	2025-08-29 11:40:31.416339
3980	manager	12	2025-08-29 11:40:31.419416
3981	manager	15	2025-08-29 11:40:31.422356
3982	manager	16	2025-08-29 11:40:31.425079
3983	manager	18	2025-08-29 11:40:31.427703
3984	manager	19	2025-08-29 11:40:31.430333
3985	manager	20	2025-08-29 11:40:31.433246
3986	manager	365	2025-08-29 11:40:31.436714
5212	director	23	2025-09-17 09:44:10.913615
5213	director	24	2025-09-17 09:44:10.924633
5214	director	361	2025-09-17 09:44:10.956904
5215	director	362	2025-09-17 09:44:10.991941
5216	director	363	2025-09-17 09:44:11.005714
5217	director	364	2025-09-17 09:44:11.031504
5218	director	365	2025-09-17 09:44:11.057128
5219	director	1213	2025-09-17 09:44:11.070201
5220	director	1216	2025-09-17 09:44:11.090795
5221	director	1220	2025-09-17 09:44:11.106477
5222	director	1222	2025-09-17 09:44:11.133962
3998	warehouse	1	2025-08-29 11:40:31.476714
3999	warehouse	361	2025-08-29 11:40:31.480053
4000	warehouse	5	2025-08-29 11:40:31.485879
4001	warehouse	6	2025-08-29 11:40:31.489814
4002	warehouse	8	2025-08-29 11:40:31.495323
4003	warehouse	18	2025-08-29 11:40:31.500796
4004	warehouse	20	2025-08-29 11:40:31.505312
4005	warehouse	365	2025-08-29 11:40:31.509799
4201	director	1	2025-09-02 19:31:19.851861
4202	director	2	2025-09-02 19:31:19.856075
4203	director	3	2025-09-02 19:31:19.860756
4204	director	4	2025-09-02 19:31:19.863973
4205	director	5	2025-09-02 19:31:19.869135
4206	director	6	2025-09-02 19:31:19.872277
4207	director	7	2025-09-02 19:31:19.877284
4208	director	8	2025-09-02 19:31:19.880924
4209	director	9	2025-09-02 19:31:19.887429
4210	director	10	2025-09-02 19:31:19.893943
4211	director	11	2025-09-02 19:31:19.899498
4212	director	12	2025-09-02 19:31:19.904287
4213	director	13	2025-09-02 19:31:19.908985
4214	director	14	2025-09-02 19:31:19.912035
4215	director	15	2025-09-02 19:31:19.915064
4216	director	16	2025-09-02 19:31:19.919031
4217	director	17	2025-09-02 19:31:19.922761
4218	director	18	2025-09-02 19:31:19.929421
4219	director	19	2025-09-02 19:31:19.934889
4220	director	20	2025-09-02 19:31:19.940346
4221	director	21	2025-09-02 19:31:19.946869
4222	director	22	2025-09-02 19:31:19.950933
4223	director	23	2025-09-02 19:31:19.95483
4224	director	24	2025-09-02 19:31:19.957672
4225	director	361	2025-09-02 19:31:19.962391
4226	director	362	2025-09-02 19:31:19.973887
4227	director	363	2025-09-02 19:31:19.977945
4228	director	364	2025-09-02 19:31:19.982089
4229	director	365	2025-09-02 19:31:19.986153
4230	manager	1	2025-09-02 19:31:19.991563
4231	manager	2	2025-09-02 19:31:19.995677
4232	manager	3	2025-09-02 19:31:19.998747
4233	manager	361	2025-09-02 19:31:20.004774
4234	manager	5	2025-09-02 19:31:20.01245
4235	manager	8	2025-09-02 19:31:20.016147
4236	manager	9	2025-09-02 19:31:20.021064
4237	manager	10	2025-09-02 19:31:20.024479
4238	manager	11	2025-09-02 19:31:20.029394
4239	manager	362	2025-09-02 19:31:20.032645
4240	manager	12	2025-09-02 19:31:20.035691
4241	manager	15	2025-09-02 19:31:20.040991
4242	manager	16	2025-09-02 19:31:20.044585
4243	manager	18	2025-09-02 19:31:20.047946
4244	manager	19	2025-09-02 19:31:20.052495
4245	manager	20	2025-09-02 19:31:20.056926
4246	manager	365	2025-09-02 19:31:20.061528
5223	director	1225	2025-09-17 09:44:11.151437
5224	manager	1	2025-09-17 09:44:11.169552
5225	manager	2	2025-09-17 09:44:11.18025
5226	manager	3	2025-09-17 09:44:11.198103
5227	manager	361	2025-09-17 09:44:11.218492
5228	manager	5	2025-09-17 09:44:11.233111
5229	manager	8	2025-09-17 09:44:11.249984
5230	manager	9	2025-09-17 09:44:11.264476
5231	manager	10	2025-09-17 09:44:11.271393
5232	manager	11	2025-09-17 09:44:11.2843
5233	manager	1213	2025-09-17 09:44:11.302565
4258	warehouse	1	2025-09-02 19:31:20.129158
4259	warehouse	361	2025-09-02 19:31:20.134942
4260	warehouse	5	2025-09-02 19:31:20.140867
4261	warehouse	6	2025-09-02 19:31:20.148067
4262	warehouse	8	2025-09-02 19:31:20.153746
4263	warehouse	18	2025-09-02 19:31:20.159221
4264	warehouse	20	2025-09-02 19:31:20.163728
4265	warehouse	365	2025-09-02 19:31:20.169281
4321	production	18	2025-09-04 10:27:59.233566
4322	production	1	2025-09-04 10:27:59.233566
4323	production	5	2025-09-04 10:27:59.233566
4324	production	8	2025-09-04 10:27:59.233566
4325	production	12	2025-09-04 10:27:59.233566
4326	production	13	2025-09-04 10:27:59.233566
4327	production	14	2025-09-04 10:27:59.233566
4328	production	15	2025-09-04 10:27:59.233566
4329	production	17	2025-09-04 10:27:59.233566
4330	production	18	2025-09-04 10:27:59.233566
4331	production	1	2025-09-04 10:27:59.233566
4332	production	5	2025-09-04 10:27:59.233566
4333	production	8	2025-09-04 10:27:59.233566
4334	production	12	2025-09-04 10:27:59.233566
4335	production	13	2025-09-04 10:27:59.233566
4336	production	14	2025-09-04 10:27:59.233566
4337	production	15	2025-09-04 10:27:59.233566
4338	production	17	2025-09-04 10:27:59.233566
4339	production	18	2025-09-04 10:27:59.233566
4340	production	1	2025-09-04 10:27:59.233566
4341	production	5	2025-09-04 10:27:59.233566
4342	production	8	2025-09-04 10:27:59.233566
4343	production	12	2025-09-04 10:27:59.233566
4344	production	13	2025-09-04 10:27:59.233566
4345	production	14	2025-09-04 10:27:59.233566
4346	production	363	2025-09-04 10:27:59.233566
4347	production	15	2025-09-04 10:27:59.233566
4348	production	17	2025-09-04 10:27:59.233566
4349	production	364	2025-09-04 10:27:59.233566
4350	production	18	2025-09-04 10:27:59.233566
4351	production	1	2025-09-04 10:27:59.233566
4352	production	5	2025-09-04 10:27:59.233566
4353	production	8	2025-09-04 10:27:59.233566
4354	production	12	2025-09-04 10:27:59.233566
4355	production	13	2025-09-04 10:27:59.233566
4356	production	14	2025-09-04 10:27:59.233566
4357	production	363	2025-09-04 10:27:59.233566
4358	production	15	2025-09-04 10:27:59.233566
4359	production	17	2025-09-04 10:27:59.233566
4360	production	364	2025-09-04 10:27:59.233566
4361	production	18	2025-09-04 10:27:59.233566
4362	production	1	2025-09-04 10:27:59.233566
4363	production	5	2025-09-04 10:27:59.233566
4364	production	8	2025-09-04 10:27:59.233566
4365	production	12	2025-09-04 10:27:59.233566
4366	production	13	2025-09-04 10:27:59.233566
4367	production	14	2025-09-04 10:27:59.233566
4368	production	363	2025-09-04 10:27:59.233566
4369	production	15	2025-09-04 10:27:59.233566
4370	production	17	2025-09-04 10:27:59.233566
4371	production	364	2025-09-04 10:27:59.233566
4372	production	18	2025-09-04 10:27:59.233566
4373	production	1	2025-09-04 10:27:59.233566
4374	production	5	2025-09-04 10:27:59.233566
4375	production	8	2025-09-04 10:27:59.233566
4376	production	12	2025-09-04 10:27:59.233566
4377	production	13	2025-09-04 10:27:59.233566
4378	production	14	2025-09-04 10:27:59.233566
4379	production	363	2025-09-04 10:27:59.233566
4380	production	15	2025-09-04 10:27:59.233566
4381	production	17	2025-09-04 10:27:59.233566
4382	production	364	2025-09-04 10:27:59.233566
4383	production	18	2025-09-04 10:27:59.233566
4384	production	1	2025-09-04 10:27:59.233566
4385	production	5	2025-09-04 10:27:59.233566
4386	production	8	2025-09-04 10:27:59.233566
4387	production	12	2025-09-04 10:27:59.233566
4388	production	13	2025-09-04 10:27:59.233566
4389	production	14	2025-09-04 10:27:59.233566
4390	production	363	2025-09-04 10:27:59.233566
4391	production	15	2025-09-04 10:27:59.233566
4392	production	17	2025-09-04 10:27:59.233566
4393	production	364	2025-09-04 10:27:59.233566
4394	production	18	2025-09-04 10:27:59.233566
4395	production	1	2025-09-04 10:27:59.233566
4396	production	5	2025-09-04 10:27:59.233566
4397	production	8	2025-09-04 10:27:59.233566
4398	production	12	2025-09-04 10:27:59.233566
4399	production	13	2025-09-04 10:27:59.233566
4400	production	14	2025-09-04 10:27:59.233566
4401	production	363	2025-09-04 10:27:59.233566
4402	production	15	2025-09-04 10:27:59.233566
4403	production	17	2025-09-04 10:27:59.233566
4404	production	364	2025-09-04 10:27:59.233566
4405	production	18	2025-09-04 10:27:59.233566
4406	production	1	2025-09-04 10:27:59.233566
4407	production	5	2025-09-04 10:27:59.233566
4408	production	8	2025-09-04 10:27:59.233566
4409	production	12	2025-09-04 10:27:59.233566
4410	production	13	2025-09-04 10:27:59.233566
4411	production	14	2025-09-04 10:27:59.233566
4412	production	363	2025-09-04 10:27:59.233566
4413	production	15	2025-09-04 10:27:59.233566
4414	production	17	2025-09-04 10:27:59.233566
4415	production	364	2025-09-04 10:27:59.233566
4416	production	18	2025-09-04 10:27:59.233566
4417	production	1	2025-09-04 10:27:59.233566
4418	production	5	2025-09-04 10:27:59.233566
4419	production	8	2025-09-04 10:27:59.233566
4420	production	12	2025-09-04 10:27:59.233566
4421	production	13	2025-09-04 10:27:59.233566
4422	production	14	2025-09-04 10:27:59.233566
4423	production	363	2025-09-04 10:27:59.233566
4424	production	15	2025-09-04 10:27:59.233566
4425	production	17	2025-09-04 10:27:59.233566
4426	production	364	2025-09-04 10:27:59.233566
4427	production	18	2025-09-04 10:27:59.233566
4428	production	1	2025-09-04 10:27:59.233566
4429	production	5	2025-09-04 10:27:59.233566
4430	production	8	2025-09-04 10:27:59.233566
4431	production	12	2025-09-04 10:27:59.233566
4432	production	13	2025-09-04 10:27:59.233566
4433	production	14	2025-09-04 10:27:59.233566
4434	production	363	2025-09-04 10:27:59.233566
4435	production	15	2025-09-04 10:27:59.233566
4436	production	17	2025-09-04 10:27:59.233566
4437	production	364	2025-09-04 10:27:59.233566
4438	production	18	2025-09-04 10:27:59.233566
4439	production	1	2025-09-04 10:27:59.233566
4440	production	5	2025-09-04 10:27:59.233566
4441	production	8	2025-09-04 10:27:59.233566
4442	production	12	2025-09-04 10:27:59.233566
4443	production	13	2025-09-04 10:27:59.233566
4444	production	14	2025-09-04 10:27:59.233566
4445	production	363	2025-09-04 10:27:59.233566
4446	production	15	2025-09-04 10:27:59.233566
4447	production	17	2025-09-04 10:27:59.233566
4448	production	364	2025-09-04 10:27:59.233566
4449	production	18	2025-09-04 10:27:59.233566
4450	production	1	2025-09-04 10:27:59.233566
4451	production	5	2025-09-04 10:27:59.233566
4452	production	8	2025-09-04 10:27:59.233566
4453	production	12	2025-09-04 10:27:59.233566
4454	production	13	2025-09-04 10:27:59.233566
4455	production	14	2025-09-04 10:27:59.233566
4456	production	363	2025-09-04 10:27:59.233566
4457	production	15	2025-09-04 10:27:59.233566
4458	production	17	2025-09-04 10:27:59.233566
4459	production	364	2025-09-04 10:27:59.233566
4460	production	18	2025-09-04 10:27:59.233566
4461	production	1	2025-09-04 10:27:59.233566
4462	production	5	2025-09-04 10:27:59.233566
4463	production	8	2025-09-04 10:27:59.233566
4464	production	12	2025-09-04 10:27:59.233566
4465	production	13	2025-09-04 10:27:59.233566
4466	production	14	2025-09-04 10:27:59.233566
4467	production	15	2025-09-04 10:27:59.233566
4468	production	17	2025-09-04 10:27:59.233566
4469	production	18	2025-09-04 10:27:59.233566
4470	production	1	2025-09-04 10:27:59.233566
4471	production	5	2025-09-04 10:27:59.233566
4472	production	8	2025-09-04 10:27:59.233566
4473	production	12	2025-09-04 10:27:59.233566
4474	production	13	2025-09-04 10:27:59.233566
4475	production	14	2025-09-04 10:27:59.233566
4476	production	363	2025-09-04 10:27:59.233566
4477	production	15	2025-09-04 10:27:59.233566
4478	production	17	2025-09-04 10:27:59.233566
4479	production	364	2025-09-04 10:27:59.233566
4480	production	18	2025-09-04 10:27:59.233566
4481	production	1	2025-09-04 10:27:59.233566
4482	production	5	2025-09-04 10:27:59.233566
4483	production	8	2025-09-04 10:27:59.233566
4484	production	12	2025-09-04 10:27:59.233566
4485	production	13	2025-09-04 10:27:59.233566
4486	production	14	2025-09-04 10:27:59.233566
4487	production	363	2025-09-04 10:27:59.233566
4488	production	15	2025-09-04 10:27:59.233566
4489	production	17	2025-09-04 10:27:59.233566
4490	production	364	2025-09-04 10:27:59.233566
4491	production	18	2025-09-04 10:27:59.233566
4492	production	1	2025-09-04 10:27:59.233566
4493	production	5	2025-09-04 10:27:59.233566
4494	production	8	2025-09-04 10:27:59.233566
4495	production	12	2025-09-04 10:27:59.233566
4496	production	13	2025-09-04 10:27:59.233566
4497	production	14	2025-09-04 10:27:59.233566
4498	production	363	2025-09-04 10:27:59.233566
4499	production	15	2025-09-04 10:27:59.233566
4500	production	17	2025-09-04 10:27:59.233566
4501	production	364	2025-09-04 10:27:59.233566
4502	production	18	2025-09-04 10:27:59.233566
4503	production	1	2025-09-04 10:27:59.233566
4504	production	5	2025-09-04 10:27:59.233566
4505	production	8	2025-09-04 10:27:59.233566
4506	production	12	2025-09-04 10:27:59.233566
4507	production	13	2025-09-04 10:27:59.233566
4508	production	14	2025-09-04 10:27:59.233566
4509	production	363	2025-09-04 10:27:59.233566
4510	production	15	2025-09-04 10:27:59.233566
4511	production	17	2025-09-04 10:27:59.233566
4512	production	364	2025-09-04 10:27:59.233566
4513	production	18	2025-09-04 10:27:59.233566
4514	production	1	2025-09-04 10:27:59.233566
4515	production	5	2025-09-04 10:27:59.233566
4516	production	8	2025-09-04 10:27:59.233566
4517	production	12	2025-09-04 10:27:59.233566
4518	production	13	2025-09-04 10:27:59.233566
4519	production	14	2025-09-04 10:27:59.233566
4520	production	363	2025-09-04 10:27:59.233566
4521	production	15	2025-09-04 10:27:59.233566
4522	production	17	2025-09-04 10:27:59.233566
4523	production	364	2025-09-04 10:27:59.233566
4524	production	18	2025-09-04 10:27:59.233566
4525	production	1	2025-09-04 10:27:59.233566
4526	production	5	2025-09-04 10:27:59.233566
4527	production	8	2025-09-04 10:27:59.233566
4528	production	12	2025-09-04 10:27:59.233566
4529	production	13	2025-09-04 10:27:59.233566
4530	production	14	2025-09-04 10:27:59.233566
4531	production	363	2025-09-04 10:27:59.233566
4532	production	15	2025-09-04 10:27:59.233566
4533	production	17	2025-09-04 10:27:59.233566
4534	production	364	2025-09-04 10:27:59.233566
4535	production	18	2025-09-04 10:27:59.233566
4536	production	1	2025-09-04 10:27:59.233566
4537	production	5	2025-09-04 10:27:59.233566
4538	production	8	2025-09-04 10:27:59.233566
4539	production	12	2025-09-04 10:27:59.233566
4540	production	13	2025-09-04 10:27:59.233566
4541	production	14	2025-09-04 10:27:59.233566
4542	production	363	2025-09-04 10:27:59.233566
4543	production	15	2025-09-04 10:27:59.233566
4544	production	17	2025-09-04 10:27:59.233566
4545	production	364	2025-09-04 10:27:59.233566
4546	production	18	2025-09-04 10:27:59.233566
4547	production	1	2025-09-04 10:27:59.233566
4548	production	5	2025-09-04 10:27:59.233566
4549	production	8	2025-09-04 10:27:59.233566
4550	production	12	2025-09-04 10:27:59.233566
4551	production	13	2025-09-04 10:27:59.233566
4552	production	14	2025-09-04 10:27:59.233566
4553	production	363	2025-09-04 10:27:59.233566
4554	production	15	2025-09-04 10:27:59.233566
4555	production	17	2025-09-04 10:27:59.233566
4556	production	364	2025-09-04 10:27:59.233566
4557	production	18	2025-09-04 10:27:59.233566
4558	production	1	2025-09-04 10:27:59.233566
4559	production	5	2025-09-04 10:27:59.233566
4560	production	8	2025-09-04 10:27:59.233566
4561	production	12	2025-09-04 10:27:59.233566
4562	production	13	2025-09-04 10:27:59.233566
4563	production	14	2025-09-04 10:27:59.233566
4564	production	363	2025-09-04 10:27:59.233566
4565	production	15	2025-09-04 10:27:59.233566
4566	production	17	2025-09-04 10:27:59.233566
4567	production	364	2025-09-04 10:27:59.233566
4568	production	18	2025-09-04 10:27:59.233566
4569	production	1	2025-09-04 10:27:59.233566
4570	production	5	2025-09-04 10:27:59.233566
4571	production	8	2025-09-04 10:27:59.233566
4572	production	12	2025-09-04 10:27:59.233566
4573	production	13	2025-09-04 10:27:59.233566
4574	production	14	2025-09-04 10:27:59.233566
4575	production	363	2025-09-04 10:27:59.233566
4576	production	15	2025-09-04 10:27:59.233566
4577	production	17	2025-09-04 10:27:59.233566
4578	production	364	2025-09-04 10:27:59.233566
4579	production	18	2025-09-04 10:27:59.233566
4580	production	16	2025-09-04 10:27:59.233566
4581	director	1	2025-09-11 06:28:18.453355
4582	director	2	2025-09-11 06:28:18.459457
4583	director	3	2025-09-11 06:28:18.464957
4584	director	4	2025-09-11 06:28:18.469805
4585	director	5	2025-09-11 06:28:18.47451
4586	director	6	2025-09-11 06:28:18.482311
4587	director	7	2025-09-11 06:28:18.487623
4588	director	8	2025-09-11 06:28:18.495792
4589	director	9	2025-09-11 06:28:18.50052
4590	director	10	2025-09-11 06:28:18.505463
4591	director	11	2025-09-11 06:28:18.509479
4592	director	12	2025-09-11 06:28:18.51332
4593	director	13	2025-09-11 06:28:18.518292
4594	director	14	2025-09-11 06:28:18.52364
4595	director	15	2025-09-11 06:28:18.527805
4596	director	16	2025-09-11 06:28:18.531256
4597	director	17	2025-09-11 06:28:18.535237
4598	director	18	2025-09-11 06:28:18.541877
4599	director	19	2025-09-11 06:28:18.548811
4600	director	20	2025-09-11 06:28:18.554207
4601	director	21	2025-09-11 06:28:18.559461
4602	director	22	2025-09-11 06:28:18.564879
4603	director	23	2025-09-11 06:28:18.572715
4604	director	24	2025-09-11 06:28:18.585536
4605	director	361	2025-09-11 06:28:18.59115
4606	director	362	2025-09-11 06:28:18.59535
4607	director	363	2025-09-11 06:28:18.620327
4608	director	364	2025-09-11 06:28:18.626533
4609	director	365	2025-09-11 06:28:18.631744
4610	manager	1	2025-09-11 06:28:18.635747
4611	manager	2	2025-09-11 06:28:18.641586
4612	manager	3	2025-09-11 06:28:18.64622
4613	manager	361	2025-09-11 06:28:18.650653
4614	manager	5	2025-09-11 06:28:18.655673
4615	manager	8	2025-09-11 06:28:18.660988
4616	manager	9	2025-09-11 06:28:18.67429
4617	manager	10	2025-09-11 06:28:18.677964
4618	manager	11	2025-09-11 06:28:18.682945
4619	manager	362	2025-09-11 06:28:18.693554
4620	manager	12	2025-09-11 06:28:18.698046
4621	manager	15	2025-09-11 06:28:18.702995
4622	manager	16	2025-09-11 06:28:18.707372
4623	manager	18	2025-09-11 06:28:18.717783
4624	manager	19	2025-09-11 06:28:18.721631
4625	manager	20	2025-09-11 06:28:18.725869
4626	manager	365	2025-09-11 06:28:18.73094
4627	production	1	2025-09-11 06:28:18.736098
4628	production	5	2025-09-11 06:28:18.742091
4629	production	8	2025-09-11 06:28:18.745221
4630	production	12	2025-09-11 06:28:18.74939
4631	production	13	2025-09-11 06:28:18.756627
4632	production	14	2025-09-11 06:28:18.764212
4633	production	363	2025-09-11 06:28:18.769897
4634	production	15	2025-09-11 06:28:18.804561
4635	production	17	2025-09-11 06:28:18.81406
4636	production	364	2025-09-11 06:28:18.816793
4637	production	18	2025-09-11 06:28:18.821489
4638	warehouse	1	2025-09-11 06:28:18.828507
4639	warehouse	361	2025-09-11 06:28:18.842523
4640	warehouse	5	2025-09-11 06:28:18.847177
4641	warehouse	6	2025-09-11 06:28:18.852214
4642	warehouse	8	2025-09-11 06:28:18.863182
4643	warehouse	18	2025-09-11 06:28:18.86842
4644	warehouse	20	2025-09-11 06:28:18.872666
4645	warehouse	365	2025-09-11 06:28:18.877801
4646	director	1	2025-09-11 12:09:12.667576
4647	director	2	2025-09-11 12:09:12.685941
4648	director	3	2025-09-11 12:09:12.701755
4649	director	4	2025-09-11 12:09:12.727765
4650	director	5	2025-09-11 12:09:12.745042
4651	director	6	2025-09-11 12:09:12.769148
4652	director	7	2025-09-11 12:09:12.794979
4653	director	8	2025-09-11 12:09:12.804703
4654	director	9	2025-09-11 12:09:12.821204
4655	director	10	2025-09-11 12:09:12.84342
4656	director	11	2025-09-11 12:09:12.860342
4657	director	12	2025-09-11 12:09:12.891521
4658	director	13	2025-09-11 12:09:12.904101
4659	director	14	2025-09-11 12:09:12.928672
4660	director	15	2025-09-11 12:09:12.96246
4661	director	16	2025-09-11 12:09:12.990352
4662	director	17	2025-09-11 12:09:12.995051
4663	director	18	2025-09-11 12:09:13.016157
4664	director	19	2025-09-11 12:09:13.029566
4665	director	20	2025-09-11 12:09:13.050521
4666	director	21	2025-09-11 12:09:13.060816
4667	director	22	2025-09-11 12:09:13.085358
4668	director	23	2025-09-11 12:09:13.104148
4669	director	24	2025-09-11 12:09:13.125529
4670	director	361	2025-09-11 12:09:13.13842
4671	director	362	2025-09-11 12:09:13.157371
4672	director	363	2025-09-11 12:09:13.175046
4673	director	364	2025-09-11 12:09:13.187752
4674	director	365	2025-09-11 12:09:13.201579
4675	manager	1	2025-09-11 12:09:13.218911
4676	manager	2	2025-09-11 12:09:13.22761
4677	manager	3	2025-09-11 12:09:13.243883
4678	manager	361	2025-09-11 12:09:13.246864
4679	manager	5	2025-09-11 12:09:13.2633
4680	manager	8	2025-09-11 12:09:13.277666
4681	manager	9	2025-09-11 12:09:13.294536
4682	manager	10	2025-09-11 12:09:13.308807
4683	manager	11	2025-09-11 12:09:13.348035
4684	manager	362	2025-09-11 12:09:13.367872
4685	manager	12	2025-09-11 12:09:13.383974
4686	manager	15	2025-09-11 12:09:13.40455
4687	manager	16	2025-09-11 12:09:13.438698
4688	manager	18	2025-09-11 12:09:13.556309
4689	manager	19	2025-09-11 12:09:14.064938
4690	manager	20	2025-09-11 12:09:14.205791
4691	manager	365	2025-09-11 12:09:14.350097
4692	production	1	2025-09-11 12:09:14.388105
4693	production	5	2025-09-11 12:09:14.403577
4694	production	8	2025-09-11 12:09:14.424115
4695	production	12	2025-09-11 12:09:14.440153
4696	production	13	2025-09-11 12:09:14.451506
4697	production	14	2025-09-11 12:09:14.478944
4698	production	363	2025-09-11 12:09:14.495153
4699	production	15	2025-09-11 12:09:14.519807
4700	production	17	2025-09-11 12:09:14.560258
4701	production	364	2025-09-11 12:09:14.590439
4702	production	18	2025-09-11 12:09:14.620917
4703	warehouse	1	2025-09-11 12:09:14.6382
4704	warehouse	361	2025-09-11 12:09:14.649948
4705	warehouse	5	2025-09-11 12:09:14.668935
4706	warehouse	6	2025-09-11 12:09:14.692312
4707	warehouse	8	2025-09-11 12:09:14.708209
4708	warehouse	18	2025-09-11 12:09:14.728881
4709	warehouse	20	2025-09-11 12:09:14.746874
4710	warehouse	365	2025-09-11 12:09:14.773139
4711	director	1	2025-09-11 13:09:04.213483
4712	director	2	2025-09-11 13:09:04.278936
4713	director	3	2025-09-11 13:09:04.284966
4714	director	4	2025-09-11 13:09:04.293409
4715	director	5	2025-09-11 13:09:04.296157
4716	director	6	2025-09-11 13:09:04.298684
4717	director	7	2025-09-11 13:09:04.301197
4718	director	8	2025-09-11 13:09:04.308916
4719	director	9	2025-09-11 13:09:04.313518
4720	director	10	2025-09-11 13:09:04.315881
4721	director	11	2025-09-11 13:09:04.319235
4722	director	12	2025-09-11 13:09:04.326084
4723	director	13	2025-09-11 13:09:04.328938
4724	director	14	2025-09-11 13:09:04.331332
4725	director	15	2025-09-11 13:09:04.333791
4726	director	16	2025-09-11 13:09:04.336015
4727	director	17	2025-09-11 13:09:04.338459
4728	director	18	2025-09-11 13:09:04.340871
4729	director	19	2025-09-11 13:09:04.345528
4730	director	20	2025-09-11 13:09:04.348462
4731	director	21	2025-09-11 13:09:04.351245
4732	director	22	2025-09-11 13:09:04.353767
4733	director	23	2025-09-11 13:09:04.356299
4734	director	24	2025-09-11 13:09:04.358979
4735	director	361	2025-09-11 13:09:04.363449
4736	director	362	2025-09-11 13:09:04.366737
4737	director	363	2025-09-11 13:09:04.370308
4738	director	364	2025-09-11 13:09:04.374013
4739	director	365	2025-09-11 13:09:04.376589
4740	manager	1	2025-09-11 13:09:04.379876
4741	manager	2	2025-09-11 13:09:04.382516
4742	manager	3	2025-09-11 13:09:04.38542
4743	manager	361	2025-09-11 13:09:04.387527
4744	manager	5	2025-09-11 13:09:04.38986
4745	manager	8	2025-09-11 13:09:04.394278
4746	manager	9	2025-09-11 13:09:04.396727
4747	manager	10	2025-09-11 13:09:04.398951
4748	manager	11	2025-09-11 13:09:04.401213
4749	manager	362	2025-09-11 13:09:04.404637
4750	manager	12	2025-09-11 13:09:04.407753
4751	manager	15	2025-09-11 13:09:04.410676
4752	manager	16	2025-09-11 13:09:04.414308
4753	manager	18	2025-09-11 13:09:04.4172
4754	manager	19	2025-09-11 13:09:04.427415
4755	manager	20	2025-09-11 13:09:04.430556
4756	manager	365	2025-09-11 13:09:04.432677
4757	production	1	2025-09-11 13:09:04.434843
4758	production	5	2025-09-11 13:09:04.436766
4759	production	8	2025-09-11 13:09:04.445238
4760	production	12	2025-09-11 13:09:04.447736
4761	production	13	2025-09-11 13:09:04.45067
4762	production	14	2025-09-11 13:09:04.458314
4763	production	363	2025-09-11 13:09:04.461677
4764	production	15	2025-09-11 13:09:04.464521
4765	production	17	2025-09-11 13:09:04.467923
4766	production	364	2025-09-11 13:09:04.470681
4767	production	18	2025-09-11 13:09:04.474191
4768	warehouse	1	2025-09-11 13:09:04.476778
4769	warehouse	361	2025-09-11 13:09:04.479771
4770	warehouse	5	2025-09-11 13:09:04.481986
4771	warehouse	6	2025-09-11 13:09:04.4842
4772	warehouse	8	2025-09-11 13:09:04.487075
4773	warehouse	18	2025-09-11 13:09:04.489146
4774	warehouse	20	2025-09-11 13:09:04.492126
4775	warehouse	365	2025-09-11 13:09:04.494719
4776	director	1	2025-09-11 15:22:29.099798
4777	director	2	2025-09-11 15:22:29.103666
4778	director	3	2025-09-11 15:22:29.106415
4779	director	4	2025-09-11 15:22:29.109501
4780	director	5	2025-09-11 15:22:29.112729
4781	director	6	2025-09-11 15:22:29.11768
4782	director	7	2025-09-11 15:22:29.120908
4783	director	8	2025-09-11 15:22:29.123638
4784	director	9	2025-09-11 15:22:29.126546
4785	director	10	2025-09-11 15:22:29.129559
4786	director	11	2025-09-11 15:22:29.132202
4787	director	12	2025-09-11 15:22:29.135164
4788	director	13	2025-09-11 15:22:29.137762
4789	director	14	2025-09-11 15:22:29.140445
4790	director	15	2025-09-11 15:22:29.143993
4791	director	16	2025-09-11 15:22:29.147166
4792	director	17	2025-09-11 15:22:29.149808
4793	director	18	2025-09-11 15:22:29.152475
4794	director	19	2025-09-11 15:22:29.155215
4795	director	20	2025-09-11 15:22:29.158032
4796	director	21	2025-09-11 15:22:29.160505
4797	director	22	2025-09-11 15:22:29.163176
4798	director	23	2025-09-11 15:22:29.165897
4799	director	24	2025-09-11 15:22:29.168908
4800	director	361	2025-09-11 15:22:29.171583
4801	director	362	2025-09-11 15:22:29.174324
4802	director	363	2025-09-11 15:22:29.177574
4803	director	364	2025-09-11 15:22:29.180658
4804	director	365	2025-09-11 15:22:29.183399
4805	manager	1	2025-09-11 15:22:29.186242
4806	manager	2	2025-09-11 15:22:29.188926
4807	manager	3	2025-09-11 15:22:29.191385
4808	manager	361	2025-09-11 15:22:29.195393
4809	manager	5	2025-09-11 15:22:29.211045
4810	manager	8	2025-09-11 15:22:29.213801
4811	manager	9	2025-09-11 15:22:29.217
4812	manager	10	2025-09-11 15:22:29.219963
4813	manager	11	2025-09-11 15:22:29.223075
4814	manager	362	2025-09-11 15:22:29.227964
4815	manager	12	2025-09-11 15:22:29.231268
4816	manager	15	2025-09-11 15:22:29.234036
4817	manager	16	2025-09-11 15:22:29.236948
4818	manager	18	2025-09-11 15:22:29.23917
4819	manager	19	2025-09-11 15:22:29.243585
4820	manager	20	2025-09-11 15:22:29.246351
4821	manager	365	2025-09-11 15:22:29.249829
4822	production	1	2025-09-11 15:22:29.252388
4823	production	5	2025-09-11 15:22:29.254836
4824	production	8	2025-09-11 15:22:29.257052
4825	production	12	2025-09-11 15:22:29.259446
4826	production	13	2025-09-11 15:22:29.261912
4827	production	14	2025-09-11 15:22:29.264303
4828	production	363	2025-09-11 15:22:29.266684
4829	production	15	2025-09-11 15:22:29.268748
4830	production	17	2025-09-11 15:22:29.271086
4831	production	364	2025-09-11 15:22:29.277182
4832	production	18	2025-09-11 15:22:29.280838
4833	warehouse	1	2025-09-11 15:22:29.284159
4834	warehouse	361	2025-09-11 15:22:29.287149
4835	warehouse	5	2025-09-11 15:22:29.290029
4836	warehouse	6	2025-09-11 15:22:29.293293
4837	warehouse	8	2025-09-11 15:22:29.295702
4838	warehouse	18	2025-09-11 15:22:29.298597
4839	warehouse	20	2025-09-11 15:22:29.301066
4840	warehouse	365	2025-09-11 15:22:29.303402
4841	director	1	2025-09-11 15:32:08.27615
4842	director	2	2025-09-11 15:32:08.288814
4843	director	3	2025-09-11 15:32:08.300077
4844	director	4	2025-09-11 15:32:08.325776
4845	director	5	2025-09-11 15:32:08.34289
4846	director	6	2025-09-11 15:32:08.361636
4847	director	7	2025-09-11 15:32:08.383565
4848	director	8	2025-09-11 15:32:08.398968
4849	director	9	2025-09-11 15:32:08.415277
4850	director	10	2025-09-11 15:32:08.435022
4851	director	11	2025-09-11 15:32:08.444443
4852	director	12	2025-09-11 15:32:08.449751
4853	director	13	2025-09-11 15:32:08.459639
4854	director	14	2025-09-11 15:32:08.464251
4855	director	15	2025-09-11 15:32:08.471306
4856	director	16	2025-09-11 15:32:08.477843
4857	director	17	2025-09-11 15:32:08.482793
4858	director	18	2025-09-11 15:32:08.490375
4859	director	19	2025-09-11 15:32:08.498067
4860	director	20	2025-09-11 15:32:08.504557
4861	director	21	2025-09-11 15:32:08.514362
4862	director	22	2025-09-11 15:32:08.525688
4863	director	23	2025-09-11 15:32:08.530069
4864	director	24	2025-09-11 15:32:08.540586
4865	director	361	2025-09-11 15:32:08.548682
4866	director	362	2025-09-11 15:32:08.552849
4867	director	363	2025-09-11 15:32:08.559145
4868	director	364	2025-09-11 15:32:08.567046
4869	director	365	2025-09-11 15:32:08.57005
4870	manager	1	2025-09-11 15:32:08.577128
4871	manager	2	2025-09-11 15:32:08.582086
4872	manager	3	2025-09-11 15:32:08.588682
4873	manager	361	2025-09-11 15:32:08.592225
4874	manager	5	2025-09-11 15:32:08.598542
4875	manager	8	2025-09-11 15:32:08.611215
4876	manager	9	2025-09-11 15:32:08.62803
4877	manager	10	2025-09-11 15:32:08.653281
4878	manager	11	2025-09-11 15:32:08.757664
4879	manager	362	2025-09-11 15:32:08.767484
4880	manager	12	2025-09-11 15:32:08.785101
4881	manager	15	2025-09-11 15:32:08.794673
4882	manager	16	2025-09-11 15:32:08.800466
4883	manager	18	2025-09-11 15:32:08.814779
4884	manager	19	2025-09-11 15:32:08.825085
4885	manager	20	2025-09-11 15:32:08.831053
4886	manager	365	2025-09-11 15:32:08.839894
4887	production	1	2025-09-11 15:32:08.847498
4888	production	5	2025-09-11 15:32:08.856473
4889	production	8	2025-09-11 15:32:08.871896
4890	production	12	2025-09-11 15:32:08.881358
4891	production	13	2025-09-11 15:32:08.908963
4892	production	14	2025-09-11 15:32:08.91675
4893	production	363	2025-09-11 15:32:08.935107
4894	production	15	2025-09-11 15:32:08.940144
4895	production	17	2025-09-11 15:32:08.966902
4896	production	364	2025-09-11 15:32:08.98188
4897	production	18	2025-09-11 15:32:08.995983
4898	warehouse	1	2025-09-11 15:32:09.000323
4899	warehouse	361	2025-09-11 15:32:09.007276
4900	warehouse	5	2025-09-11 15:32:09.014524
4901	warehouse	6	2025-09-11 15:32:09.022093
4902	warehouse	8	2025-09-11 15:32:09.032249
4903	warehouse	18	2025-09-11 15:32:09.041736
4904	warehouse	20	2025-09-11 15:32:09.059705
4905	warehouse	365	2025-09-11 15:32:09.070467
4906	director	1	2025-09-11 16:42:49.845762
4907	director	2	2025-09-11 16:42:49.853402
4908	director	3	2025-09-11 16:42:49.85857
4909	director	4	2025-09-11 16:42:49.869019
4910	director	5	2025-09-11 16:42:49.877039
4911	director	6	2025-09-11 16:42:49.884886
4912	director	7	2025-09-11 16:42:49.895401
4913	director	8	2025-09-11 16:42:49.907062
4914	director	9	2025-09-11 16:42:49.918752
4915	director	10	2025-09-11 16:42:49.946599
4916	director	11	2025-09-11 16:42:49.965829
4917	director	12	2025-09-11 16:42:49.976465
4918	director	13	2025-09-11 16:42:49.980568
4919	director	14	2025-09-11 16:42:49.988306
4920	director	15	2025-09-11 16:42:49.994749
4921	director	16	2025-09-11 16:42:49.997401
4922	director	17	2025-09-11 16:42:50.005405
4923	director	18	2025-09-11 16:42:50.011553
4924	director	19	2025-09-11 16:42:50.017393
4925	director	20	2025-09-11 16:42:50.031908
4926	director	21	2025-09-11 16:42:50.040721
4927	director	22	2025-09-11 16:42:50.046001
4928	director	23	2025-09-11 16:42:50.075259
4929	director	24	2025-09-11 16:42:50.081239
4930	director	361	2025-09-11 16:42:50.09708
4931	director	362	2025-09-11 16:42:50.100363
4932	director	363	2025-09-11 16:42:50.108192
4933	director	364	2025-09-11 16:42:50.122321
4934	director	365	2025-09-11 16:42:50.127941
4935	manager	1	2025-09-11 16:42:50.135164
4936	manager	2	2025-09-11 16:42:50.141497
4937	manager	3	2025-09-11 16:42:50.146443
4938	manager	361	2025-09-11 16:42:50.173
4939	manager	5	2025-09-11 16:42:50.19689
4940	manager	8	2025-09-11 16:42:50.236538
4941	manager	9	2025-09-11 16:42:50.267567
4942	manager	10	2025-09-11 16:42:50.276756
4943	manager	11	2025-09-11 16:42:50.283128
4944	manager	362	2025-09-11 16:42:50.294474
4945	manager	12	2025-09-11 16:42:50.306383
4946	manager	15	2025-09-11 16:42:50.318786
4947	manager	16	2025-09-11 16:42:50.322532
4948	manager	18	2025-09-11 16:42:50.334047
4949	manager	19	2025-09-11 16:42:50.345819
4950	manager	20	2025-09-11 16:42:50.355044
4951	manager	365	2025-09-11 16:42:50.362069
4952	production	1	2025-09-11 16:42:50.371733
4953	production	5	2025-09-11 16:42:50.376621
4954	production	8	2025-09-11 16:42:50.381753
4955	production	12	2025-09-11 16:42:50.387339
4956	production	13	2025-09-11 16:42:50.391673
4957	production	14	2025-09-11 16:42:50.397718
4958	production	363	2025-09-11 16:42:50.403467
4959	production	15	2025-09-11 16:42:50.409247
4960	production	17	2025-09-11 16:42:50.415852
4961	production	364	2025-09-11 16:42:50.428723
4962	production	18	2025-09-11 16:42:50.435855
4963	warehouse	1	2025-09-11 16:42:50.440232
4964	warehouse	361	2025-09-11 16:42:50.444129
4965	warehouse	5	2025-09-11 16:42:50.449085
4966	warehouse	6	2025-09-11 16:42:50.459899
4967	warehouse	8	2025-09-11 16:42:50.464671
4968	warehouse	18	2025-09-11 16:42:50.479947
4969	warehouse	20	2025-09-11 16:42:50.489965
4970	warehouse	365	2025-09-11 16:42:50.496012
5234	manager	362	2025-09-17 09:44:11.32357
5235	manager	12	2025-09-17 09:44:11.340026
5236	manager	1216	2025-09-17 09:44:11.349014
5237	manager	15	2025-09-17 09:44:11.368924
5238	manager	16	2025-09-17 09:44:11.379389
5239	manager	1222	2025-09-17 09:44:11.392096
5240	manager	18	2025-09-17 09:44:11.401005
5241	manager	19	2025-09-17 09:44:11.410437
5242	manager	1225	2025-09-17 09:44:11.421334
5243	manager	20	2025-09-17 09:44:11.437649
5244	manager	365	2025-09-17 09:44:11.448163
5245	manager	21	2025-09-17 09:44:11.460707
5246	production	1	2025-09-17 09:44:11.480422
5247	production	5	2025-09-17 09:44:11.496626
5248	production	8	2025-09-17 09:44:11.526204
5249	production	12	2025-09-17 09:44:11.542974
5250	production	13	2025-09-17 09:44:11.559306
5251	production	1216	2025-09-17 09:44:11.605493
5252	production	14	2025-09-17 09:44:11.623689
5253	production	363	2025-09-17 09:44:11.634577
5254	production	15	2025-09-17 09:44:11.645802
5255	production	17	2025-09-17 09:44:11.658861
5256	production	1222	2025-09-17 09:44:11.671395
5257	production	364	2025-09-17 09:44:11.692646
5258	production	18	2025-09-17 09:44:11.702208
5259	warehouse	1	2025-09-17 09:44:11.715915
5260	warehouse	361	2025-09-17 09:44:11.729406
5261	warehouse	5	2025-09-17 09:44:11.743802
5262	warehouse	6	2025-09-17 09:44:11.752844
5263	warehouse	8	2025-09-17 09:44:11.762507
5264	warehouse	18	2025-09-17 09:44:11.771882
5265	warehouse	20	2025-09-17 09:44:11.78218
5266	warehouse	365	2025-09-17 09:44:11.79592
5320	manager	20	2025-09-17 10:01:23.869032
5321	manager	365	2025-09-17 10:01:23.883837
5322	manager	21	2025-09-17 10:01:23.9048
5323	production	1	2025-09-17 10:01:23.921938
5324	production	5	2025-09-17 10:01:23.9302
5325	production	8	2025-09-17 10:01:23.950687
5326	production	12	2025-09-17 10:01:23.963367
5327	production	13	2025-09-17 10:01:23.978212
5328	production	1216	2025-09-17 10:01:23.989065
5329	production	14	2025-09-17 10:01:24.001815
5330	production	363	2025-09-17 10:01:24.011838
5331	production	15	2025-09-17 10:01:24.024071
5332	production	17	2025-09-17 10:01:24.034726
5333	production	1222	2025-09-17 10:01:24.043219
5334	production	364	2025-09-17 10:01:24.057171
5335	production	18	2025-09-17 10:01:24.070819
5336	warehouse	1	2025-09-17 10:01:24.084677
5337	warehouse	361	2025-09-17 10:01:24.099375
5338	warehouse	5	2025-09-17 10:01:24.108178
5339	warehouse	6	2025-09-17 10:01:24.120481
5340	warehouse	8	2025-09-17 10:01:24.129928
5341	warehouse	18	2025-09-17 10:01:24.142858
5342	warehouse	20	2025-09-17 10:01:24.154761
5343	warehouse	365	2025-09-17 10:01:24.173686
5344	director	1	2025-09-17 10:56:28.773509
5345	director	2	2025-09-17 10:56:28.792595
5346	director	3	2025-09-17 10:56:28.799658
5347	director	4	2025-09-17 10:56:28.803312
5348	director	5	2025-09-17 10:56:28.818283
5349	director	6	2025-09-17 10:56:28.821313
5350	director	7	2025-09-17 10:56:28.825614
5351	director	8	2025-09-17 10:56:28.831014
5352	director	9	2025-09-17 10:56:28.835948
5353	director	10	2025-09-17 10:56:28.839615
5354	director	11	2025-09-17 10:56:28.847788
5355	director	12	2025-09-17 10:56:28.864749
5356	director	13	2025-09-17 10:56:28.872683
5357	director	14	2025-09-17 10:56:28.876407
5358	director	15	2025-09-17 10:56:28.880862
5359	director	16	2025-09-17 10:56:28.884626
5360	director	17	2025-09-17 10:56:28.888433
5361	director	18	2025-09-17 10:56:28.892843
5362	director	19	2025-09-17 10:56:28.897542
5363	director	20	2025-09-17 10:56:28.903401
5364	director	21	2025-09-17 10:56:28.909476
5365	director	22	2025-09-17 10:56:28.913881
5366	director	23	2025-09-17 10:56:28.918642
5367	director	24	2025-09-17 10:56:28.928222
5368	director	361	2025-09-17 10:56:28.93593
5369	director	362	2025-09-17 10:56:28.940511
5370	director	363	2025-09-17 10:56:28.943189
5371	director	364	2025-09-17 10:56:28.947234
5372	director	365	2025-09-17 10:56:28.952798
5373	director	1213	2025-09-17 10:56:28.956868
5374	director	1216	2025-09-17 10:56:28.964211
5375	director	1220	2025-09-17 10:56:28.967576
5376	director	1222	2025-09-17 10:56:28.971954
5377	director	1225	2025-09-17 10:56:28.978542
5378	manager	1	2025-09-17 10:56:28.983903
5379	manager	2	2025-09-17 10:56:28.992137
5380	manager	3	2025-09-17 10:56:28.996121
5381	manager	361	2025-09-17 10:56:29.000333
5382	manager	5	2025-09-17 10:56:29.004646
5383	manager	8	2025-09-17 10:56:29.009631
5384	manager	9	2025-09-17 10:56:29.015036
5385	manager	10	2025-09-17 10:56:29.018967
5386	manager	11	2025-09-17 10:56:29.022405
5387	manager	1213	2025-09-17 10:56:29.02808
5388	manager	362	2025-09-17 10:56:29.033541
5389	manager	12	2025-09-17 10:56:29.038739
5390	manager	1216	2025-09-17 10:56:29.044161
5391	manager	15	2025-09-17 10:56:29.047182
5392	manager	16	2025-09-17 10:56:29.050774
5393	manager	1222	2025-09-17 10:56:29.054996
5394	manager	18	2025-09-17 10:56:29.05811
5395	manager	19	2025-09-17 10:56:29.064056
5396	manager	1225	2025-09-17 10:56:29.067027
5397	manager	20	2025-09-17 10:56:29.072529
5398	manager	365	2025-09-17 10:56:29.078335
5399	manager	21	2025-09-17 10:56:29.084045
5400	production	1	2025-09-17 10:56:29.090943
5401	production	5	2025-09-17 10:56:29.09385
5402	production	8	2025-09-17 10:56:29.097113
5403	production	12	2025-09-17 10:56:29.1016
5404	production	13	2025-09-17 10:56:29.104624
5405	production	1216	2025-09-17 10:56:29.107777
5406	production	14	2025-09-17 10:56:29.111057
5407	production	363	2025-09-17 10:56:29.11566
5408	production	15	2025-09-17 10:56:29.118818
5409	production	17	2025-09-17 10:56:29.12252
5410	production	1222	2025-09-17 10:56:29.125854
5411	production	364	2025-09-17 10:56:29.129689
5412	production	18	2025-09-17 10:56:29.133726
5413	warehouse	1	2025-09-17 10:56:29.137516
5414	warehouse	361	2025-09-17 10:56:29.144605
5415	warehouse	5	2025-09-17 10:56:29.150655
5416	warehouse	6	2025-09-17 10:56:29.159742
5417	warehouse	8	2025-09-17 10:56:29.164423
5418	warehouse	18	2025-09-17 10:56:29.168652
5419	warehouse	20	2025-09-17 10:56:29.17233
5420	warehouse	365	2025-09-17 10:56:29.174899
5421	director	1	2025-09-17 11:15:42.407669
5422	director	2	2025-09-17 11:15:42.423692
5423	director	3	2025-09-17 11:15:42.438461
5424	director	4	2025-09-17 11:15:42.454149
5425	director	5	2025-09-17 11:15:42.474229
5426	director	6	2025-09-17 11:15:42.483885
5427	director	7	2025-09-17 11:15:42.493613
5428	director	8	2025-09-17 11:15:42.512292
5429	director	9	2025-09-17 11:15:42.527428
5430	director	10	2025-09-17 11:15:42.538656
5431	director	11	2025-09-17 11:15:42.552623
5432	director	12	2025-09-17 11:15:42.57182
5433	director	13	2025-09-17 11:15:42.586362
5434	director	14	2025-09-17 11:15:42.601958
5435	director	15	2025-09-17 11:15:42.610985
5436	director	16	2025-09-17 11:15:42.618951
5437	director	17	2025-09-17 11:15:42.632366
5438	director	18	2025-09-17 11:15:42.652829
5439	director	19	2025-09-17 11:15:42.661602
5440	director	20	2025-09-17 11:15:42.672529
5441	director	21	2025-09-17 11:15:42.683405
5442	director	22	2025-09-17 11:15:42.692621
5443	director	23	2025-09-17 11:15:42.700785
5444	director	24	2025-09-17 11:15:42.720572
5445	director	361	2025-09-17 11:15:42.739109
5446	director	362	2025-09-17 11:15:42.751156
5447	director	363	2025-09-17 11:15:42.79063
5448	director	364	2025-09-17 11:15:42.814343
5449	director	365	2025-09-17 11:15:42.847578
5450	director	1213	2025-09-17 11:15:42.859773
5451	director	1216	2025-09-17 11:15:42.872499
5452	director	1220	2025-09-17 11:15:42.88744
5453	director	1222	2025-09-17 11:15:42.898367
5454	director	1225	2025-09-17 11:15:42.908394
5455	manager	1	2025-09-17 11:15:42.918762
5456	manager	2	2025-09-17 11:15:42.928133
5457	manager	3	2025-09-17 11:15:42.945812
5458	manager	361	2025-09-17 11:15:42.97387
5459	manager	5	2025-09-17 11:15:42.986562
5460	manager	8	2025-09-17 11:15:43.009671
5461	manager	9	2025-09-17 11:15:43.026728
5462	manager	10	2025-09-17 11:15:43.044533
5463	manager	11	2025-09-17 11:15:43.057089
5464	manager	1213	2025-09-17 11:15:43.070032
5465	manager	362	2025-09-17 11:15:43.081485
5466	manager	12	2025-09-17 11:15:43.092167
5467	manager	1216	2025-09-17 11:15:43.102277
5468	manager	15	2025-09-17 11:15:43.113447
5469	manager	16	2025-09-17 11:15:43.125394
5470	manager	1222	2025-09-17 11:15:43.147578
5471	manager	18	2025-09-17 11:15:43.168988
5472	manager	19	2025-09-17 11:15:43.18216
5473	manager	1225	2025-09-17 11:15:43.206777
5474	manager	20	2025-09-17 11:15:43.229261
5475	manager	365	2025-09-17 11:15:43.251252
5476	manager	21	2025-09-17 11:15:43.268087
5477	production	1	2025-09-17 11:15:43.3069
5478	production	5	2025-09-17 11:15:43.32327
5479	production	8	2025-09-17 11:15:43.336691
5480	production	12	2025-09-17 11:15:43.363835
5481	production	13	2025-09-17 11:15:43.380455
5482	production	1216	2025-09-17 11:15:43.396916
5483	production	14	2025-09-17 11:15:43.414326
5484	production	363	2025-09-17 11:15:43.434226
5485	production	15	2025-09-17 11:15:43.454331
5486	production	17	2025-09-17 11:15:43.469929
5487	production	1222	2025-09-17 11:15:43.485786
5488	production	364	2025-09-17 11:15:43.498585
5489	production	18	2025-09-17 11:15:43.520852
5490	warehouse	1	2025-09-17 11:15:43.552796
5491	warehouse	361	2025-09-17 11:15:43.58238
5492	warehouse	5	2025-09-17 11:15:43.606742
5493	warehouse	6	2025-09-17 11:15:43.619952
5494	warehouse	8	2025-09-17 11:15:43.640387
5495	warehouse	18	2025-09-17 11:15:43.670384
5496	warehouse	20	2025-09-17 11:15:43.68414
5497	warehouse	365	2025-09-17 11:15:43.694329
\.


--
-- Data for Name: roll_covering_composition; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roll_covering_composition (id, roll_covering_id, carpet_id, quantity, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shipment_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipment_items (id, shipment_id, product_id, planned_quantity, actual_quantity, created_at) FROM stdin;
\.


--
-- Data for Name: shipment_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipment_orders (id, shipment_id, order_id, created_at) FROM stdin;
\.


--
-- Data for Name: shipments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shipments (id, shipment_number, planned_date, actual_date, transport_info, status, documents_photos, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock (id, product_id, current_stock, reserved_stock, updated_at) FROM stdin;
148	148	280	0	2025-09-09 12:26:16.398
3	3	50	0	2025-08-20 11:20:21.78
4	4	103	0	2025-08-20 11:23:11.188
5	5	74	0	2025-08-20 11:37:59.465
6	6	36	0	2025-08-21 06:06:56.402
7	7	0	0	2025-08-21 06:35:57.766
8	8	25	0	2025-08-21 06:46:19.307
9	9	195	0	2025-08-21 07:21:45.416
10	10	25	0	2025-08-21 10:25:54.981
13	13	133	0	2025-08-21 10:34:23.46
130	130	92	0	2025-09-03 11:44:09.236
14	14	22	0	2025-08-21 10:37:17.116
15	15	55	0	2025-08-21 10:38:39.587
16	16	16	0	2025-08-21 10:40:33.781
18	18	283	0	2025-08-21 11:16:21.598
19	19	21	0	2025-08-21 11:19:22.145
20	20	14	0	2025-08-21 11:22:14.704
21	21	15	0	2025-08-21 11:25:53.629
23	23	276	0	2025-08-21 11:34:31.026
24	24	36	0	2025-08-21 11:46:22.035
25	25	31	0	2025-08-21 11:48:02.387
26	26	34	0	2025-08-21 11:57:05.669
27	27	34	0	2025-08-21 12:01:15.022
28	28	50	0	2025-08-21 12:04:01.446
29	29	90	0	2025-08-21 12:06:31.998
30	30	156	0	2025-08-21 12:24:29.07
32	32	25	0	2025-08-21 12:27:45.876
34	34	16	0	2025-08-21 12:31:42.21
35	35	22	0	2025-08-21 12:33:33.759
36	36	20	0	2025-08-21 12:35:04.581
37	37	26	0	2025-08-21 12:36:23.073
38	38	7	0	2025-08-21 12:37:33.759
39	39	6	0	2025-08-21 12:38:51.755
40	40	24	0	2025-08-22 06:21:37.648
41	41	11	0	2025-08-22 06:22:59.421
42	42	20	0	2025-08-22 06:24:24.696
47	47	69	0	2025-08-22 06:38:14.467
48	48	178	0	2025-08-22 06:39:48.024
49	49	36	0	2025-08-22 06:41:02.492
50	50	41	0	2025-08-22 07:09:29.299
51	51	34	0	2025-08-22 07:11:03.345
55	55	24	0	2025-08-22 07:17:31.877
60	60	29	0	2025-08-22 07:44:24.653
61	61	16	0	2025-08-22 07:46:20.886
63	63	31	0	2025-08-22 07:55:51.155
65	65	76	0	2025-08-22 07:58:11.622
66	66	9	0	2025-08-22 07:59:09.461
68	68	82	0	2025-08-22 08:44:40.143
69	69	32	0	2025-08-22 08:46:05.329
72	72	60	0	2025-08-22 08:52:00.643
78	78	2276	0	2025-08-22 11:21:38.322
80	80	120	0	2025-08-22 11:27:36.104
81	81	1025	0	2025-08-22 11:30:22.96
82	82	201	0	2025-08-22 12:00:29.798
83	83	28	0	2025-08-22 12:02:47.18
85	85	19	0	2025-08-22 12:05:32.922
86	86	980	0	2025-08-22 12:06:41.204
87	87	31	0	2025-08-22 12:08:13.662
89	89	4	0	2025-08-22 12:11:25.393
92	92	27	0	2025-08-22 12:16:09.633
94	94	13	0	2025-08-22 12:19:28.935
95	95	34	0	2025-08-22 12:22:02.562
96	96	203	0	2025-08-22 12:30:02.586
97	97	100	0	2025-08-22 12:35:03.59
98	98	327	0	2025-08-22 12:56:21.226
99	99	200	0	2025-08-22 13:02:28.978
100	100	92	0	2025-08-25 06:12:30.283
101	101	36	0	2025-08-25 06:39:58.341
102	102	208	0	2025-08-25 06:42:22.891
103	103	345	0	2025-08-25 06:45:47.58
104	104	64	0	2025-08-25 06:47:57.485
105	105	50	0	2025-08-25 06:50:11.17
106	106	50	0	2025-08-25 06:51:29.978
107	107	187	0	2025-08-25 06:53:14.183
108	108	50	0	2025-08-25 06:55:25.831
109	109	40	0	2025-08-25 07:04:15.57
110	110	140	0	2025-08-25 07:08:26.072
111	111	178	0	2025-08-25 07:14:15.636
112	112	456	0	2025-08-25 07:17:07.905
113	113	51	0	2025-08-25 07:19:01.821
115	115	77	0	2025-08-25 07:22:14.398
114	114	310	0	2025-08-25 07:30:49.217
127	127	160	0	2025-09-10 12:20:04.785
46	46	71	0	2025-08-27 13:00:57.799
144	144	23	0	2025-09-08 12:40:54.635
71	71	132	0	2025-09-08 12:22:42.241
116	116	0	0	2025-09-01 09:14:59.458
120	120	1100	0	2025-09-02 07:31:07.88
121	121	704	0	2025-09-02 07:37:06.773
123	123	51	0	2025-09-02 07:42:30.054
124	124	168	0	2025-09-02 07:46:33.887
126	126	77	0	2025-09-03 11:28:18.287
129	129	100	0	2025-09-03 11:36:06.863
131	131	100	0	2025-09-03 11:40:48.988
133	133	50	0	2025-09-03 11:49:47.416
134	134	137	0	2025-09-03 11:52:43.718
135	135	92	0	2025-09-03 11:55:56.272
137	137	34	0	2025-09-03 12:01:14.459
138	138	200	0	2025-09-03 12:02:54.403
139	139	79	0	2025-09-03 12:05:40.709
140	140	140	0	2025-09-03 12:07:37.418
141	141	456	0	2025-09-03 12:10:37.597
142	142	51	0	2025-09-03 12:12:12.978
119	119	1919	0	2025-09-09 12:16:04.627
125	125	120	0	2025-09-04 07:23:38.431
31	31	212	0	2025-09-11 12:59:24.826
76	76	10697	0	2025-09-11 07:02:28.551
122	122	1661	0	2025-09-11 07:03:17.754
117	117	720	0	2025-09-11 07:03:55.955
84	84	695	0	2025-09-08 18:12:38.151
75	75	1887	0	2025-09-11 07:01:37.891
118	118	1436	0	2025-09-09 10:55:55.185
143	143	343	0	2025-09-04 08:05:53.048
57	57	65	0	2025-09-09 11:41:14.521
44	44	91	0	2025-09-12 12:35:32.444
146	146	13	0	2025-09-16 13:19:25.217
88	88	142	0	2025-09-08 17:00:23.297
91	91	45	0	2025-09-05 09:50:13.647
149	149	2037	0	2025-09-04 09:25:54.885
150	150	260	0	2025-09-04 09:29:15.619
151	151	122	0	2025-09-04 09:30:53.175
152	152	372	0	2025-09-04 09:34:05.248
153	153	200	0	2025-09-04 09:35:27.472
154	154	47	0	2025-09-04 09:37:10.237
155	155	1307	0	2025-09-04 09:38:10.846
64	64	322	0	2025-09-10 12:40:33.771
93	93	77	0	2025-09-05 10:04:30.014
53	53	412	0	2025-09-08 17:02:26.072
74	74	1911	0	2025-09-11 06:59:44.277
58	58	0	0	2025-09-09 11:49:15.168
79	79	2594	0	2025-09-11 12:52:26.304
45	45	170	0	2025-09-08 12:43:00.052
52	52	124	0	2025-09-08 12:44:13.417
56	56	0	0	2025-09-08 12:48:15.352
43	43	336	0	2025-09-11 10:45:36.052
73	73	1268	0	2025-09-12 13:07:16.729
147	147	0	0	2025-09-16 13:17:35.602
12	12	715	0	2025-09-11 12:50:06.455
2	2	438	0	2025-09-09 12:12:12.348
145	145	53	0	2025-09-11 12:42:03.147
67	67	358	0	2025-09-11 07:29:02.658
62	62	4	0	2025-09-09 10:57:05.082
54	54	15	0	2025-09-09 11:17:10.312
59	59	13	0	2025-09-09 11:40:02.541
1	1	1380	0	2025-09-09 12:17:04.563
33	33	43	0	2025-09-09 13:09:53.651
77	77	2655	0	2025-09-09 13:21:21.533
132	132	105	0	2025-09-09 13:32:11.142
22	22	0	0	2025-09-09 13:34:52.756
90	90	56	0	2025-09-22 09:19:02.256
128	128	30	0	2025-09-18 15:15:33.141
156	156	40	0	2025-09-04 09:38:57.93
157	157	50	0	2025-09-04 09:39:52.109
158	158	1483	0	2025-09-04 09:43:49.593
159	159	2	0	2025-09-04 11:31:43.15
160	160	1	0	2025-09-04 11:34:34.442
161	161	1	0	2025-09-04 11:36:37.623
11	11	512	0	2025-09-05 06:14:06.005
163	163	1231	0	2025-09-05 12:25:21.706
165	165	0	0	2025-09-08 12:31:59.846
166	166	0	0	2025-09-08 17:05:38.185
70	70	345	0	2025-09-08 17:39:01.28
170	170	252	0	2025-09-09 11:38:31.686
185	185	0	0	2025-09-09 12:03:11.135
172	172	31	0	2025-09-09 12:06:36.538
171	171	0	0	2025-09-09 12:09:41.996
183	183	0	0	2025-09-09 12:24:26.689
169	169	0	0	2025-09-09 12:27:24.914
176	176	1	0	2025-09-09 12:29:42.264
174	174	2	0	2025-09-09 12:31:18.723
175	175	3	0	2025-09-09 12:32:38.386
177	177	97	0	2025-09-09 12:34:13.236
178	178	107	0	2025-09-09 12:38:16.457
173	173	125	0	2025-09-09 13:23:04.554
181	181	0	0	2025-09-09 13:39:00.753
182	182	0	0	2025-09-09 13:40:10.967
180	180	0	0	2025-09-09 13:42:15.294
186	186	137	0	2025-09-09 13:57:18.888
168	168	290	0	2025-09-09 13:57:49.152
164	164	212	0	2025-09-11 06:56:57.703
162	162	240	0	2025-09-11 07:11:07.408
184	184	994	0	2025-09-11 12:43:25.598
167	167	1274	0	2025-09-11 12:51:18.407
187	187	24	0	2025-09-11 12:55:06.129
188	188	0	0	2025-09-11 12:58:13.825
179	179	28	0	2025-09-11 12:59:58.735
189	189	161	0	2025-09-11 13:05:09.672
190	190	130	0	2025-09-11 13:07:06.808
191	191	14	0	2025-09-11 13:19:56.197
194	194	4	0	2025-09-11 16:46:20.218
195	195	13	0	2025-09-11 16:57:30.816
201	201	2	0	2025-09-11 17:34:56.103
17	17	1195	0	2025-09-12 12:37:42.026
220	220	320	0	2025-09-12 13:10:06.492
200	200	0	0	2025-09-16 10:44:46.209
199	199	0	0	2025-09-16 10:47:04.975
198	198	0	0	2025-09-16 10:48:06.224
197	197	0	0	2025-09-16 10:50:03.145
196	196	0	0	2025-09-16 10:51:51.169
202	202	0	0	2025-09-16 11:14:40.282
204	204	0	0	2025-09-16 11:20:13.048
203	203	0	0	2025-09-16 11:20:54.515
208	208	0	0	2025-09-16 11:23:48.895
210	210	0	0	2025-09-16 11:24:28.332
209	209	0	0	2025-09-16 11:25:02.441
211	211	0	0	2025-09-16 11:26:28.848
212	212	0	0	2025-09-16 11:26:52.316
213	213	0	0	2025-09-16 11:27:49.676
216	216	0	0	2025-09-16 11:28:11.214
205	205	0	0	2025-09-16 11:28:35.873
207	207	0	0	2025-09-16 11:29:13.467
206	206	0	0	2025-09-16 11:29:38.278
214	214	0	0	2025-09-16 11:30:22.334
215	215	0	0	2025-09-16 11:30:49.539
193	193	0	0	2025-09-16 11:31:23.236
219	219	0	0	2025-09-16 11:32:13.508
217	217	0	0	2025-09-16 11:32:35.521
192	192	0	0	2025-09-16 11:33:08.303
218	218	0	0	2025-09-16 11:34:44.765
136	136	281	281	2025-09-22 09:19:39.269
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, product_id, movement_type, quantity, reference_id, reference_type, comment, user_id, created_at) FROM stdin;
1	2	incoming	1473	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-20 11:14:05.296
2	1	adjustment	1850	\N	\N	Корректировка остатка через карточку товара	6	2025-08-20 11:16:55.03604
3	3	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-20 11:20:21.784
4	4	incoming	103	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-20 11:23:11.192
5	5	incoming	74	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-20 11:37:59.47
6	6	incoming	36	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 06:06:56.41
7	8	incoming	25	\N	initial_stock	Начальное оприходование при создании товара	1	2025-08-21 06:46:19.312
8	9	incoming	195	\N	initial_stock	Начальное оприходование при создании товара	1	2025-08-21 07:21:45.42
9	10	incoming	25	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 10:25:54.986
10	11	incoming	512	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 10:30:10.613
11	13	incoming	133	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 10:34:23.463
12	12	adjustment	783	\N	\N	Корректировка остатка через карточку товара	6	2025-08-21 10:34:56.563595
13	14	incoming	22	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 10:37:17.119
14	15	incoming	55	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 10:38:39.591
15	16	incoming	16	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 10:40:33.785
16	17	incoming	451	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:12:14.985
17	18	adjustment	283	\N	\N	Корректировка остатка через карточку товара	6	2025-08-21 11:16:21.597779
18	19	incoming	21	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:19:22.15
19	20	incoming	14	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:22:14.708
20	21	incoming	15	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:25:53.633
21	22	incoming	342	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:29:02.642
22	23	incoming	276	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:34:31.031
23	24	incoming	36	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:46:22.04
24	25	incoming	31	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:48:02.391
25	26	incoming	34	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 11:57:05.676
26	27	incoming	34	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:01:15.027
27	28	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:04:01.451
28	29	incoming	90	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:06:32.003
29	30	incoming	156	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:24:29.074
30	31	incoming	251	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:25:55.049
31	32	incoming	25	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:27:45.88
32	33	incoming	73	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:29:26.182
33	34	incoming	16	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:31:42.214
34	35	incoming	22	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:33:33.763
35	36	incoming	20	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:35:04.584
36	37	incoming	26	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:36:23.076
37	38	incoming	7	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:37:33.763
38	39	incoming	6	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-21 12:38:51.761
39	33	adjustment	120	\N	\N	Корректировка остатка через карточку товара	6	2025-08-21 12:41:13.968238
40	40	incoming	24	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:21:37.652
41	41	incoming	11	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:22:59.426
42	42	incoming	20	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:24:24.7
43	43	incoming	817	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:29:59.952
44	44	incoming	943	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:34:05.04
45	45	incoming	707	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:35:45.963
46	46	incoming	47	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:37:03.919
47	47	incoming	69	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:38:14.477
48	48	incoming	178	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:39:48.028
49	49	incoming	36	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 06:41:02.496
50	50	incoming	41	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:09:29.303
51	51	incoming	34	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:11:03.349
52	52	incoming	90	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:12:23.729
53	53	incoming	263	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:13:54.001
54	54	incoming	19	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:15:37.41
55	55	incoming	24	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:17:31.882
56	56	incoming	49	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:27:41.891
57	57	incoming	89	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:29:09.222
58	58	incoming	88	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:32:07.997
59	59	incoming	54	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:33:42.092
60	60	incoming	29	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:44:24.657
61	61	incoming	16	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:46:20.89
62	62	incoming	124	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:48:18.461
63	63	incoming	31	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:55:51.159
64	64	incoming	78	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:57:13.621
65	65	incoming	76	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:58:11.626
66	66	incoming	9	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 07:59:09.464
67	67	incoming	11	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 08:42:50.745
68	68	incoming	82	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 08:44:40.146
69	69	incoming	32	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 08:46:05.334
70	70	incoming	297	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 08:47:50.325
71	71	incoming	180	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 08:49:11.377
72	72	incoming	60	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 08:52:00.648
73	73	incoming	873	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 10:43:52.131
74	74	incoming	914	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 10:47:09.809
75	75	incoming	891	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 10:49:13.926
76	76	incoming	9701	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 11:01:13.703
77	77	incoming	3510	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 11:08:59.34
78	78	incoming	2276	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 11:21:38.326
79	79	incoming	2668	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 11:23:29.478
80	80	incoming	120	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 11:27:36.111
81	81	incoming	1025	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 11:30:22.965
82	82	incoming	201	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:00:29.803
83	83	incoming	28	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:02:47.184
84	84	incoming	695	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:04:16.713
85	85	incoming	19	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:05:32.93
86	86	incoming	980	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:06:41.207
87	87	incoming	31	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:08:13.669
88	88	incoming	40	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:10:05.248
89	89	incoming	4	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:11:25.399
90	90	incoming	66	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:12:51.323
91	91	incoming	43	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:14:38.152
92	92	incoming	27	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:16:09.637
93	93	incoming	37	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:17:44.308
94	94	incoming	13	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:19:28.943
95	95	incoming	34	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:22:02.566
96	96	incoming	203	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:30:02.591
97	97	incoming	100	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:35:03.595
98	98	incoming	327	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 12:56:21.233
99	99	incoming	200	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-22 13:02:28.983
153	73	adjustment	717	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 07:42:56.75972
100	100	incoming	92	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:12:30.291
101	101	adjustment	36	\N	\N	Корректировка остатка через карточку товара	6	2025-08-25 06:39:58.340173
102	102	incoming	208	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:42:22.894
103	103	incoming	345	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:45:47.584
104	104	incoming	64	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:47:57.489
105	105	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:50:11.174
106	106	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:51:29.985
107	107	incoming	187	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:53:14.188
108	108	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 06:55:25.835
109	109	incoming	40	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:04:15.574
110	110	incoming	140	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:08:26.076
111	111	incoming	178	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:14:15.64
112	112	incoming	456	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:17:07.911
113	113	incoming	51	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:19:01.826
114	114	incoming	277	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:20:44.815
115	115	incoming	77	\N	initial_stock	Начальное оприходование при создании товара	6	2025-08-25 07:22:14.402
116	114	adjustment	33	\N	\N	Корректировка остатка через карточку товара	6	2025-08-25 07:30:49.215137
117	90	reservation	50	1	order	\N	1	2025-08-25 09:10:48.811681
118	46	adjustment	24	\N	\N	Корректировка остатка через карточку товара	6	2025-08-27 13:00:57.798478
119	17	adjustment	46	\N	\N	приход	1	2025-08-29 12:02:38.19913
120	12	adjustment	46	\N	\N	Приход 16.08	1	2025-08-29 12:08:35.059463
121	117	incoming	296	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 06:59:41.337
122	118	incoming	1502	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:02:55.27
123	119	incoming	1957	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:04:22.799
124	120	incoming	1100	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:31:07.886
125	121	incoming	704	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:37:06.777
126	122	incoming	704	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:40:41.846
127	123	incoming	51	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:42:30.057
128	124	incoming	168	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-02 07:46:33.901
129	126	incoming	77	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:28:18.291
130	127	incoming	310	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:31:30.294
131	128	incoming	272	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:33:50.805
132	129	incoming	100	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:36:06.866
133	130	incoming	18	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:38:39.137
134	131	adjustment	100	\N	\N	Корректировка остатка через карточку товара	1	2025-09-03 11:40:48.985848
135	130	adjustment	74	\N	\N	Корректировка остатка через карточку товара	1	2025-09-03 11:44:09.233564
136	132	incoming	105	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:47:34.123
137	133	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:49:47.422
138	134	incoming	137	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:52:43.723
139	135	incoming	92	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:55:56.275
140	136	incoming	250	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 11:58:48.05
141	137	incoming	34	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 12:01:14.469
142	138	incoming	200	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 12:02:54.408
143	139	incoming	79	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 12:05:40.712
144	140	incoming	140	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 12:07:37.421
145	141	incoming	456	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 12:10:37.601
146	142	incoming	51	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-03 12:12:12.982
147	12	adjustment	806	\N	\N	Изготовлены за период с 16.08-02.09	1	2025-09-04 07:14:00.517196
148	17	adjustment	795	\N	\N	Изготовлены за период с 16.08-02.09	1	2025-09-04 07:15:47.188157
149	64	adjustment	799	\N	\N	Изготовлены за 16.08-02.09	1	2025-09-04 07:22:56.752971
150	125	adjustment	120	\N	\N	Корректировка остатка через карточку товара	1	2025-09-04 07:23:38.431727
151	67	adjustment	12	\N	\N	Изготовлены	1	2025-09-04 07:38:47.727716
152	74	adjustment	717	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 07:41:31.567214
154	75	adjustment	716	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 07:47:08.228719
155	76	adjustment	717	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 07:49:07.515661
156	136	adjustment	796	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 07:53:26.528782
157	88	adjustment	443	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 07:58:54.630503
158	143	adjustment	343	\N	\N	Корректировка остатка через карточку товара	1	2025-09-04 08:05:53.049786
159	53	adjustment	635	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 08:08:56.733977
160	52	adjustment	428	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 08:14:29.140918
161	144	incoming	443	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 08:25:24.648
162	145	incoming	757	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 08:31:42.001
163	146	adjustment	139	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 08:35:18.685218
164	147	incoming	92	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 08:41:09.007
165	122	adjustment	677	\N	\N	Изготовлены 16.08-02.09	1	2025-09-04 08:43:23.519676
166	117	adjustment	555	\N	\N	Изготовлены 27.08-02.09	1	2025-09-04 08:44:44.511412
167	148	incoming	543	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 08:48:07.909
168	149	incoming	2037	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:25:54.895
169	150	incoming	260	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:29:15.625
170	151	incoming	122	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:30:53.184
171	152	incoming	372	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:34:05.251
172	153	incoming	200	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:35:27.486
173	154	incoming	47	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:37:10.24
174	155	incoming	1307	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:38:10.857
175	156	incoming	40	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:38:57.962
176	157	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:39:52.119
177	158	incoming	1483	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 09:43:49.597
178	159	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 11:31:43.155
179	160	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 11:34:34.449
180	161	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-04 11:36:37.634
181	11	adjustment	45	\N	\N	Изготовлены	1	2025-09-05 06:12:29.301909
182	11	adjustment	-45	\N	\N	Ошибочно добавлены	1	2025-09-05 06:14:06.002308
183	12	adjustment	45	\N	\N	Изготовлены	1	2025-09-05 06:14:52.379045
184	17	adjustment	45	\N	\N	Изготовлены	1	2025-09-05 06:15:42.226025
185	67	adjustment	45	\N	\N	Изготовлены	1	2025-09-05 06:19:37.371932
186	88	adjustment	44	\N	\N	Изготовлены	1	2025-09-05 06:21:46.967482
187	136	adjustment	45	\N	\N	Изготовлены	1	2025-09-05 06:24:30.234376
188	74	adjustment	40	\N	\N	Изготовлены	1	2025-09-05 06:30:15.977514
189	73	adjustment	40	\N	\N	Изготовлены	1	2025-09-05 06:31:06.564539
190	75	adjustment	40	\N	\N	Изготовлены	1	2025-09-05 06:32:13.116162
191	76	adjustment	40	\N	\N	Изготовлены	1	2025-09-05 06:32:42.837485
192	117	adjustment	80	\N	\N	Изготовлены	1	2025-09-05 06:33:46.141318
193	122	adjustment	40	\N	\N	Изготовлены	1	2025-09-05 06:34:09.851403
194	162	incoming	45	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-05 06:39:00.725
195	145	adjustment	91	\N	\N	Изготовлены	1	2025-09-05 06:40:53.732214
196	91	adjustment	2	\N	\N	Корректировка остатка через карточку товара	1	2025-09-05 09:50:13.646778
197	93	adjustment	40	\N	\N	Корректировка остатка через карточку товара	1	2025-09-05 10:04:30.013102
198	71	adjustment	-48	\N	\N	В резку	1	2025-09-05 10:14:48.513784
199	17	adjustment	-162	\N	\N	В резку	1	2025-09-05 10:16:07.763036
200	144	adjustment	-104	\N	\N	В резку	1	2025-09-05 10:19:34.550244
201	163	incoming	1231	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-05 12:25:21.724
202	71	adjustment	-48	\N	\N	В резку	1	2025-09-08 06:45:42.875391
203	12	adjustment	-559	\N	\N	В резку	1	2025-09-08 06:48:02.950105
204	17	adjustment	-454	\N	\N	В резку	1	2025-09-08 06:50:24.841836
205	2	adjustment	-708	\N	\N	В резку	1	2025-09-08 06:51:59.681539
206	67	adjustment	12	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 07:20:47.149219
207	67	adjustment	11	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 07:22:44.090923
208	64	adjustment	-23	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 07:24:14.895959
209	17	adjustment	162	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 07:41:51.772528
210	144	adjustment	104	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 11:28:01.443776
211	12	adjustment	85	\N	\N	Изготовлены 04-05.09	1	2025-09-08 11:53:12.837458
212	17	adjustment	85	\N	\N	Изготовлены 04-05.09	1	2025-09-08 11:55:45.433926
213	88	adjustment	46	\N	\N	Изготовлены 04.09	1	2025-09-08 11:57:47.48017
214	136	adjustment	85	\N	\N	Изготовлены 04-05.09	1	2025-09-08 11:59:36.069904
215	74	adjustment	80	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:00:26.818751
216	73	adjustment	80	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:01:18.216693
217	75	adjustment	80	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:02:40.560005
218	76	adjustment	80	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:03:22.29647
219	122	adjustment	80	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:04:12.933169
220	117	adjustment	160	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:04:48.536822
221	145	adjustment	199	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:06:04.820711
222	67	adjustment	85	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:09:22.446383
223	162	adjustment	99	\N	\N	Изготовлены 04-05.09	1	2025-09-08 12:10:13.946822
224	164	incoming	36	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 12:15:56.174
225	71	adjustment	48	\N	\N	Ошибочно списаны 48	1	2025-09-08 12:22:42.23756
226	165	incoming	87	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 12:30:58.431
227	165	adjustment	-87	\N	\N	В резку с 16-21.08	1	2025-09-08 12:31:59.844463
228	84	adjustment	-40	\N	\N	В резку 16.09	1	2025-09-08 12:37:43.411627
229	144	adjustment	257	\N	\N	Коректировка	1	2025-09-08 12:39:40.167016
230	144	adjustment	-677	\N	\N	В резку с 15.08-25.08	1	2025-09-08 12:40:54.634401
231	45	adjustment	-537	\N	\N	В резку 16-20.09	1	2025-09-08 12:43:00.052141
232	52	adjustment	-394	\N	\N	В резку 17-23.08	1	2025-09-08 12:44:13.416472
233	56	adjustment	1	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 12:47:18.833618
234	56	adjustment	-50	\N	\N	В резку 17-18.09	1	2025-09-08 12:48:15.351894
235	43	adjustment	-407	\N	\N	В резку 18-25.09	1	2025-09-08 12:56:54.364541
236	67	adjustment	126	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 13:19:54.705394
237	88	adjustment	-431	\N	\N	В резку 20-31.08	1	2025-09-08 17:00:23.294849
238	53	adjustment	-486	\N	\N	В резку 22-29.08	1	2025-09-08 17:02:26.070695
239	166	incoming	123	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 17:04:43.58
240	166	adjustment	-123	\N	\N	В резку 25-29.08	1	2025-09-08 17:05:38.184465
241	44	adjustment	-124	\N	\N	В резку 02-03.09	1	2025-09-08 17:30:43.812425
242	31	adjustment	-11	\N	\N	В резку 03.09	1	2025-09-08 17:31:53.459339
243	79	adjustment	-50	\N	\N	В резку 03.09\n	1	2025-09-08 17:33:27.452642
244	145	adjustment	-836	\N	\N	В резку 04-06.09	1	2025-09-08 17:35:36.392319
245	70	adjustment	48	\N	\N	Из резки 15.08	1	2025-09-08 17:39:01.279571
246	167	incoming	600	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 17:44:56.434
247	57	adjustment	59	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 17:46:54.053513
248	57	adjustment	89	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 17:49:45.291138
249	168	incoming	690	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 17:52:22.803
250	84	adjustment	40	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 18:12:38.145853
251	169	incoming	100	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 18:16:33.93
252	170	incoming	359	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 18:22:44.147
253	58	adjustment	370	\N	\N	Из резки 17-23.09	1	2025-09-08 18:37:37.02385
254	171	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 18:40:02.808
255	172	incoming	407	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-08 18:43:09.508
256	43	adjustment	407	\N	\N	Корректировка остатка через карточку товара	1	2025-09-08 18:49:42.414741
257	44	adjustment	-407	\N	\N	В резку 18-25.08	1	2025-09-08 18:51:47.853047
258	173	incoming	431	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:05:35.035
259	59	adjustment	294	\N	\N	Из резки 22.08	1	2025-09-09 06:07:12.275172
260	174	incoming	402	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:10:30.119
261	175	incoming	433	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:13:15.113
262	176	incoming	66	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:15:46.914
263	177	incoming	708	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:18:39.786
264	178	incoming	122	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:21:24.288
265	179	incoming	106	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:27:28.78
266	180	incoming	124	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:41:33.65
267	181	incoming	10	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:48:59.891
268	182	incoming	10	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:51:17.813
269	183	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:55:37.765
270	184	incoming	836	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 06:58:32.955
271	179	adjustment	14	\N	\N	Из резки	1	2025-09-09 07:15:04.599259
272	179	adjustment	-120	\N	\N	Продажа 100-15.08,  20-04.09	1	2025-09-09 07:16:00.765409
273	117	adjustment	-691	\N	\N	Продажа 15.08-01.09	1	2025-09-09 10:55:01.019053
274	118	adjustment	-66	\N	\N	Продажа 15-20.08.25	1	2025-09-09 10:55:55.184639
275	62	adjustment	-120	\N	\N	Продажа 15.08.25	1	2025-09-09 10:57:05.082769
276	54	adjustment	-4	\N	\N	Продажа 15.08.25	1	2025-09-09 11:17:10.309003
277	170	adjustment	-107	\N	\N	Продажа 18.08 и 02.09	1	2025-09-09 11:38:31.680005
278	59	adjustment	-335	\N	\N	Продажа 18 и 27.08	1	2025-09-09 11:40:02.534269
279	57	adjustment	-172	\N	\N	Продажа 18.08	1	2025-09-09 11:41:14.513897
280	58	adjustment	128	\N	\N	Корректировка остатка через карточку товара	1	2025-09-09 11:44:18.075547
281	58	adjustment	-586	\N	\N	Продажа 18-29.08	1	2025-09-09 11:49:15.159997
282	185	incoming	23	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 12:02:42.155
283	185	adjustment	-23	\N	\N	Продажа 18.08	1	2025-09-09 12:03:11.126932
284	172	adjustment	-376	\N	\N	Продажа 18.08-02.09.25	1	2025-09-09 12:06:36.528618
285	171	adjustment	-50	\N	\N	Продажа 18.08.25	1	2025-09-09 12:09:41.987275
286	2	adjustment	-327	\N	\N	Продажа 18.08.25	1	2025-09-09 12:12:12.340382
287	136	adjustment	-120	\N	\N	Продажа 18.08.25	1	2025-09-09 12:15:13.118049
288	119	adjustment	-38	\N	\N	Продажа 20.08.25	1	2025-09-09 12:16:04.618368
289	1	adjustment	-470	\N	\N	Продажа 21.08.25	1	2025-09-09 12:17:04.554228
290	183	adjustment	20	\N	\N	Корректировка остатка через карточку товара	1	2025-09-09 12:23:42.957802
291	183	adjustment	-70	\N	\N	Продажа	1	2025-09-09 12:24:26.683024
292	148	adjustment	-263	\N	\N	Продажа  26.08-01.09.25	1	2025-09-09 12:26:16.392914
293	169	adjustment	-100	\N	\N	Продажа 26.08	1	2025-09-09 12:27:24.909197
294	176	adjustment	-65	\N	\N	Продажа 26.08.25	1	2025-09-09 12:29:42.259427
295	174	adjustment	-400	\N	\N	Продажа 27 08.25	1	2025-09-09 12:31:18.718756
296	175	adjustment	-430	\N	\N	Продажа29.08 и 03.09.25	1	2025-09-09 12:32:38.38039
297	177	adjustment	-611	\N	\N	Продажа 29.08 и 02.09.25	1	2025-09-09 12:34:13.231259
298	178	adjustment	-15	\N	\N	Продажа 01.09.25	1	2025-09-09 12:38:16.452295
299	33	adjustment	-150	\N	\N	Продажа 01.09.25	1	2025-09-09 13:09:53.651549
300	77	adjustment	-540	\N	\N	Продажа 01.09 и 03.09.25	1	2025-09-09 13:15:48.239227
301	77	adjustment	-315	\N	\N	Продажа 02.09	1	2025-09-09 13:21:21.533673
302	173	adjustment	-306	\N	\N	Продажа 02,-03.08.25	1	2025-09-09 13:23:04.555327
303	132	adjustment	350	\N	\N	Корректировка остатка через карточку товара	1	2025-09-09 13:30:53.251057
304	132	adjustment	-350	\N	\N	Продажа 01.09.25	1	2025-09-09 13:32:11.142969
305	22	adjustment	54	\N	\N	Корректировка остатка через карточку товара	1	2025-09-09 13:33:32.316411
306	22	adjustment	-396	\N	\N	Продажа 02.09.25	1	2025-09-09 13:34:52.756691
307	181	adjustment	-10	\N	\N	Продажа 03.09.25	1	2025-09-09 13:39:00.753075
308	182	adjustment	-10	\N	\N	Продажа 03.09.25	1	2025-09-09 13:40:10.967862
309	180	adjustment	146	\N	\N	Корректировка остатка через карточку товара	1	2025-09-09 13:41:15.949462
310	180	adjustment	-270	\N	\N	Продажа 03.09.25	1	2025-09-09 13:42:15.294973
311	90	adjustment	-10	\N	\N	Продажа 03.09.25	1	2025-09-09 13:48:20.614009
312	186	incoming	537	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-09 13:56:23.443
313	186	adjustment	-400	\N	\N	Продажа 05.09.25	1	2025-09-09 13:57:18.888871
314	168	adjustment	-400	\N	\N	Продажа 05.09.25	1	2025-09-09 13:57:49.153298
315	128	adjustment	-61	\N	\N	Вулканизация с 15.08 -06.09	1	2025-09-10 10:22:34.999596
316	128	adjustment	25	\N	\N	Корректировка остатка через карточку товара	1	2025-09-10 10:25:32.117571
317	136	adjustment	-450	\N	\N	Продажа	1	2025-09-10 12:15:38.356259
318	136	adjustment	-506	\N	\N	Продажа	1	2025-09-10 12:17:19.639957
319	127	adjustment	-150	\N	\N	Продажа 09.09	1	2025-09-10 12:20:04.78292
320	64	adjustment	-532	\N	\N	На вулканизацию с15.08 - 06.09.25	1	2025-09-10 12:40:33.767639
321	17	adjustment	182	\N	\N	Изготовлены 06-09.25	1	2025-09-11 06:54:36.222897
322	12	adjustment	183	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 06:55:31.512182
323	164	adjustment	176	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 06:56:57.713717
324	136	adjustment	181	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 06:58:33.095826
325	74	adjustment	160	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 06:59:44.28896
326	73	adjustment	160	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:00:39.684246
327	75	adjustment	160	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:01:37.90365
328	76	adjustment	159	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:02:28.563449
329	122	adjustment	160	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:03:17.767703
330	117	adjustment	320	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:03:55.968086
331	67	adjustment	182	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:08:00.124618
332	162	adjustment	96	\N	\N	Изготовлены 06-09.09.25	1	2025-09-11 07:11:07.414666
333	67	adjustment	-137	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 07:28:28.059598
334	67	adjustment	11	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 07:29:02.66024
335	43	adjustment	-481	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 10:45:36.051157
336	145	adjustment	-158	\N	\N	В резку 07.09.	1	2025-09-11 12:42:03.143533
337	184	adjustment	158	\N	\N	Из резки 07.09	1	2025-09-11 12:43:25.595685
338	12	adjustment	-674	\N	\N	В резку с07.09 по 10.09	1	2025-09-11 12:50:06.452886
339	167	adjustment	674	\N	\N	Из резки с 07.09 по 10.09	1	2025-09-11 12:51:18.405607
340	79	adjustment	-24	\N	\N	В резку 08.09.	1	2025-09-11 12:52:26.303513
341	187	incoming	24	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 12:55:06.166
342	73	adjustment	-282	\N	\N	В резку 09.09	1	2025-09-11 12:56:25.748696
343	31	adjustment	-28	\N	\N	В резку 09.09	1	2025-09-11 12:59:24.825191
344	179	adjustment	28	\N	\N	Из резки 09.09	1	2025-09-11 12:59:58.734005
345	44	adjustment	-291	\N	\N	В резку 10.09	1	2025-09-11 13:01:51.618441
346	189	incoming	161	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 13:05:09.69
347	190	incoming	130	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 13:07:06.839
348	191	incoming	14	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 13:19:56.219
349	192	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 13:34:18.98
350	193	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 13:40:50.168
351	194	incoming	4	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 16:46:20.221
352	195	incoming	13	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 16:57:30.947
353	196	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:02:19.814
354	197	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:06:22.141
355	198	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:11:13.235
356	199	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:23:56.506
357	200	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:28:14.075
358	201	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:34:56.118
359	202	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:40:07.575
360	203	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:43:29.455
361	204	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 17:59:11.216
362	205	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:05:37.999
363	206	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:09:10.37
364	207	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:12:56.25
365	208	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:15:14.074
366	208	adjustment	1	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 18:16:53.748316
367	209	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:19:55.558
368	210	incoming	4	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:22:40.618
369	210	adjustment	3	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 18:24:22.69712
370	211	incoming	75	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:30:25.89
371	211	adjustment	-74	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 18:31:12.846889
372	212	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:34:28.871
373	213	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:37:10.619
374	214	incoming	3	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:39:35.206
375	215	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:42:30.515
376	216	incoming	16	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:48:08.546
377	216	adjustment	-15	\N	\N	Корректировка остатка через карточку товара	1	2025-09-11 18:48:31.756264
378	217	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:56:05.268
379	218	incoming	2	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 18:59:45.871
380	219	incoming	1	\N	initial_stock	Начальное оприходование при создании товара	1	2025-09-11 19:03:50.413
381	136	reservation	281	2	order	\N	1	2025-09-12 07:40:35.396019
382	44	adjustment	-30	\N	\N	В резку 10.09	8	2025-09-12 12:35:32.441362
383	17	adjustment	45	\N	\N	Изготовлены 10.09.25	1	2025-09-12 12:37:42.021275
384	73	adjustment	-320	\N	\N	В резку 10.09.	8	2025-09-12 13:07:16.72853
385	220	incoming	320	\N	initial_stock	Начальное оприходование при создании товара	8	2025-09-12 13:10:06.499
386	200	adjustment	-1	\N	\N	Продажа 16.09.25	1	2025-09-16 10:44:46.207672
387	199	adjustment	-1	\N	\N	Продажа 16.09.25	1	2025-09-16 10:47:04.97461
388	198	adjustment	-1	\N	\N	Продажа 16.09.25	1	2025-09-16 10:48:06.222891
389	197	adjustment	-1	\N	\N	Продажа 16.09.25	1	2025-09-16 10:50:03.144349
390	196	adjustment	-2	\N	\N	Продажа 16.09.25	1	2025-09-16 10:51:51.167183
391	202	adjustment	-2	\N	\N	Продажа 12.09.25	1	2025-09-16 11:14:40.280565
392	204	adjustment	-2	\N	\N	Продажа 12.09.25	1	2025-09-16 11:20:13.046131
393	203	adjustment	-2	\N	\N	Продажа 12.09.25	1	2025-09-16 11:20:54.514617
394	208	adjustment	2	\N	\N	Корректировка остатка через карточку товара	1	2025-09-16 11:23:09.505371
395	208	adjustment	-5	\N	\N	Продажа 12.09.25	1	2025-09-16 11:23:48.894657
396	210	adjustment	-7	\N	\N	Продажа 12.09.25	1	2025-09-16 11:24:28.331558
397	209	adjustment	-1	\N	\N	Продажа 12.09.25	1	2025-09-16 11:25:02.440596
398	211	adjustment	-1	\N	\N	Продажа 12.09.25	1	2025-09-16 11:26:28.846029
399	212	adjustment	-1	\N	\N	Продажа 12.09.25	1	2025-09-16 11:26:52.31531
400	213	adjustment	-2	\N	\N	Продажа 12.09.25	1	2025-09-16 11:27:49.67501
401	216	adjustment	-1	\N	\N	Продажа 12.09.25	1	2025-09-16 11:28:11.213358
402	205	adjustment	-2	\N	\N	Продажа	1	2025-09-16 11:28:35.872213
403	207	adjustment	-1	\N	\N	Продажа 15.09.25	1	2025-09-16 11:29:13.466432
404	206	adjustment	-1	\N	\N	Продажа 15.09.25\n	1	2025-09-16 11:29:38.277101
405	214	adjustment	-3	\N	\N	Продажа 15.09.25	1	2025-09-16 11:30:22.333363
406	215	adjustment	-1	\N	\N	Продажа 15.09.025	1	2025-09-16 11:30:49.537802
407	193	adjustment	-1	\N	\N	Продажа 15.09.25	1	2025-09-16 11:31:23.235356
408	219	adjustment	-1	\N	\N	Продажа 15.09.25	1	2025-09-16 11:32:13.507851
409	217	adjustment	-1	\N	\N	Продажа 15.09.25	1	2025-09-16 11:32:35.520534
410	192	adjustment	-1	\N	\N	Продажа 15.09.25	1	2025-09-16 11:33:08.302103
411	218	adjustment	-2	\N	\N	Продажа 15.09.25	1	2025-09-16 11:34:44.762877
412	147	adjustment	-92	\N	\N	В резку 17/09	1	2025-09-16 13:17:35.600611
413	146	adjustment	-5	\N	\N	Корректировка остатка через карточку товара	1	2025-09-16 13:18:24.574747
414	146	adjustment	-121	\N	\N	В резку 17/09	1	2025-09-16 13:19:25.215922
415	128	adjustment	-206	\N	\N	Корректировка остатка через карточку товара	1	2025-09-18 15:15:33.139403
416	90	release_reservation	-50	1	order	\N	1	2025-09-22 09:19:02.267731
417	136	release_reservation	-281	2	order	\N	1	2025-09-22 09:19:39.244745
418	136	reservation	281	2	order	\N	1	2025-09-22 09:19:39.275108
\.


--
-- Data for Name: telegram_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telegram_notifications (id, user_id, message_type, message_text, sent_at, status) FROM stdin;
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (id, user_id, permission_id, granted, created_at) FROM stdin;
8	6	8	f	2025-08-20 10:40:00.931996
9	6	20	f	2025-08-20 10:40:00.931996
18	9	2	f	2025-09-12 08:32:42.103112
19	9	4	f	2025-09-12 08:32:42.103112
20	9	17	t	2025-09-12 08:32:42.103112
21	9	364	t	2025-09-12 08:32:42.103112
22	9	13	t	2025-09-12 08:32:42.103112
23	9	363	t	2025-09-12 08:32:42.103112
24	9	14	t	2025-09-12 08:32:42.103112
25	8	2	t	2025-09-12 10:52:29.381027
26	8	4	t	2025-09-12 10:52:29.381027
27	8	3	t	2025-09-12 10:52:29.381027
28	8	361	t	2025-09-12 10:52:29.381027
29	8	6	t	2025-09-12 10:52:29.381027
30	8	7	t	2025-09-12 10:52:29.381027
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, telegram_id, full_name, phone, email, is_active, created_at, updated_at) FROM stdin;
1	director	$2a$10$mDHu3LVsKxXvTWs1Q4fLveRcbnTpxa7qBA4JdK8Tm1373G/EaGwQm	director	\N	Директор по продажам	+7-999-123-45-67	director@shvedoff.ru	t	2025-07-22 06:51:12.290174	2025-07-22 06:51:12.290174
7	tremolo	$2a$10$TTVtyxTY2dRdOKFy0DGVL.j3ghWDF2zDQBXMw4QsfEDxhhNpvslKa	manager	\N	Сергей Сакович	\N	\N	t	2025-08-28 08:39:40.676819	2025-08-28 08:39:40.676819
9	Vitluka	$2a$10$9.l1bLzNY2gRQTqaRruJqu85QzJKnIdaXMe0xPUONIagul.AXSVkG	warehouse	\N	Виталий Лука	\N	\N	t	2025-09-12 08:31:00.686554	2025-09-12 08:31:00.686554
8	Denis	$2a$10$PlvSxsL4LIuvg3IcGwRU7.9tRPLMoYGqcnabTImDz5fhEseQe7mtq	warehouse	\N	Денис	\N	\N	t	2025-09-04 10:27:49.845955	2025-09-04 10:27:49.845955
6	Sergey	$2a$10$roLOaZLzGif1hV52bJ69gOjSA/9dldHl.7oki.i6BM86K6z1.Wq.u	warehouse	\N	Сергей	\N	\N	t	2025-07-31 08:37:10.228818	2025-07-31 08:37:10.228818
\.


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 37, true);


--
-- Name: bottom_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bottom_types_id_seq', 5, true);


--
-- Name: carpet_edge_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carpet_edge_types_id_seq', 10, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 4, true);


--
-- Name: cutting_operations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cutting_operations_id_seq', 1, false);


--
-- Name: defect_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.defect_products_id_seq', 1, false);


--
-- Name: operation_reversals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.operation_reversals_id_seq', 1, false);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 5, true);


--
-- Name: order_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_messages_id_seq', 2, true);


--
-- Name: order_number_sequence; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_number_sequence', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 3, true);


--
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.permissions_id_seq', 1405, true);


--
-- Name: product_logos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_logos_id_seq', 18, true);


--
-- Name: product_materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_materials_id_seq', 6, true);


--
-- Name: product_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_relations_id_seq', 1, false);


--
-- Name: product_surfaces_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_surfaces_id_seq', 25, true);


--
-- Name: production_queue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_queue_id_seq', 1, false);


--
-- Name: production_task_extras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_task_extras_id_seq', 1, false);


--
-- Name: production_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.production_tasks_id_seq', 2, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 220, true);


--
-- Name: puzzle_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.puzzle_types_id_seq', 5, true);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.role_permissions_id_seq', 5497, true);


--
-- Name: roll_covering_composition_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roll_covering_composition_id_seq', 32, true);


--
-- Name: shipment_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shipment_items_id_seq', 1, false);


--
-- Name: shipment_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shipment_orders_id_seq', 1, false);


--
-- Name: shipments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shipments_id_seq', 1, false);


--
-- Name: stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_id_seq', 220, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 418, true);


--
-- Name: telegram_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.telegram_notifications_id_seq', 1, false);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_permissions_id_seq', 30, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: bottom_types bottom_types_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bottom_types
    ADD CONSTRAINT bottom_types_code_key UNIQUE (code);


--
-- Name: bottom_types bottom_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bottom_types
    ADD CONSTRAINT bottom_types_pkey PRIMARY KEY (id);


--
-- Name: carpet_edge_types carpet_edge_types_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carpet_edge_types
    ADD CONSTRAINT carpet_edge_types_code_key UNIQUE (code);


--
-- Name: carpet_edge_types carpet_edge_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carpet_edge_types
    ADD CONSTRAINT carpet_edge_types_name_key UNIQUE (name);


--
-- Name: carpet_edge_types carpet_edge_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carpet_edge_types
    ADD CONSTRAINT carpet_edge_types_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: cutting_operations cutting_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_pkey PRIMARY KEY (id);


--
-- Name: defect_products defect_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_products
    ADD CONSTRAINT defect_products_pkey PRIMARY KEY (id);


--
-- Name: operation_reversals operation_reversals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operation_reversals
    ADD CONSTRAINT operation_reversals_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_messages order_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_unique UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: product_logos product_logos_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_logos
    ADD CONSTRAINT product_logos_name_unique UNIQUE (name);


--
-- Name: product_logos product_logos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_logos
    ADD CONSTRAINT product_logos_pkey PRIMARY KEY (id);


--
-- Name: product_materials product_materials_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_name_unique UNIQUE (name);


--
-- Name: product_materials product_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_pkey PRIMARY KEY (id);


--
-- Name: product_relations product_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_relations
    ADD CONSTRAINT product_relations_pkey PRIMARY KEY (id);


--
-- Name: product_surfaces product_surfaces_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_surfaces
    ADD CONSTRAINT product_surfaces_name_unique UNIQUE (name);


--
-- Name: product_surfaces product_surfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_surfaces
    ADD CONSTRAINT product_surfaces_pkey PRIMARY KEY (id);


--
-- Name: production_queue production_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_queue
    ADD CONSTRAINT production_queue_pkey PRIMARY KEY (id);


--
-- Name: production_task_extras production_task_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_task_extras
    ADD CONSTRAINT production_task_extras_pkey PRIMARY KEY (id);


--
-- Name: production_tasks production_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_pkey PRIMARY KEY (id);


--
-- Name: products products_article_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_article_unique UNIQUE (article);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: puzzle_types puzzle_types_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.puzzle_types
    ADD CONSTRAINT puzzle_types_code_key UNIQUE (code);


--
-- Name: puzzle_types puzzle_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.puzzle_types
    ADD CONSTRAINT puzzle_types_name_key UNIQUE (name);


--
-- Name: puzzle_types puzzle_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.puzzle_types
    ADD CONSTRAINT puzzle_types_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roll_covering_composition roll_covering_composition_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roll_covering_composition
    ADD CONSTRAINT roll_covering_composition_pkey PRIMARY KEY (id);


--
-- Name: shipment_items shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_pkey PRIMARY KEY (id);


--
-- Name: shipment_orders shipment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_orders
    ADD CONSTRAINT shipment_orders_pkey PRIMARY KEY (id);


--
-- Name: shipment_orders shipment_orders_shipment_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_orders
    ADD CONSTRAINT shipment_orders_shipment_id_order_id_key UNIQUE (shipment_id, order_id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_shipment_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_shipment_number_unique UNIQUE (shipment_number);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: stock stock_product_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_unique UNIQUE (product_id);


--
-- Name: telegram_notifications telegram_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_notifications
    ADD CONSTRAINT telegram_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: idx_production_tasks_cancelled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_tasks_cancelled ON public.production_tasks USING btree (status, cancelled_by) WHERE (status = 'cancelled'::public.production_task_status);


--
-- Name: idx_production_tasks_planned_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_tasks_planned_date ON public.production_tasks USING btree (planned_date) WHERE (planned_date IS NOT NULL);


--
-- Name: idx_production_tasks_planned_date_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_tasks_planned_date_status ON public.production_tasks USING btree (planned_date, status) WHERE (planned_date IS NOT NULL);


--
-- Name: idx_products_border_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_border_type ON public.products USING btree (border_type);


--
-- Name: idx_products_bottom_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_bottom_type_id ON public.products USING btree (bottom_type_id);


--
-- Name: idx_products_carpet_edge_sides; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_carpet_edge_sides ON public.products USING btree (carpet_edge_sides);


--
-- Name: idx_products_carpet_edge_strength; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_carpet_edge_strength ON public.products USING btree (carpet_edge_strength);


--
-- Name: idx_products_carpet_edge_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_carpet_edge_type ON public.products USING btree (carpet_edge_type);


--
-- Name: idx_products_mat_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_mat_area ON public.products USING btree (mat_area);


--
-- Name: idx_products_press_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_press_type ON public.products USING btree (press_type);


--
-- Name: idx_products_product_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_product_type ON public.products USING btree (product_type);


--
-- Name: idx_products_pur_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_pur_number ON public.products USING btree (pur_number);


--
-- Name: idx_products_puzzle_options; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_puzzle_options ON public.products USING gin (puzzle_options);


--
-- Name: idx_products_puzzle_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_puzzle_type_id ON public.products USING btree (puzzle_type_id);


--
-- Name: idx_products_surface_ids; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_surface_ids ON public.products USING gin (surface_ids);


--
-- Name: idx_products_weight; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_weight ON public.products USING btree (weight);


--
-- Name: idx_puzzle_types_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_puzzle_types_code ON public.puzzle_types USING btree (code);


--
-- Name: idx_puzzle_types_system; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_puzzle_types_system ON public.puzzle_types USING btree (is_system);


--
-- Name: idx_roll_covering_composition_carpet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roll_covering_composition_carpet_id ON public.roll_covering_composition USING btree (carpet_id);


--
-- Name: idx_roll_covering_composition_roll_covering_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_roll_covering_composition_roll_covering_id ON public.roll_covering_composition USING btree (roll_covering_id);


--
-- Name: idx_shipment_orders_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_orders_composite ON public.shipment_orders USING btree (shipment_id, order_id);


--
-- Name: idx_shipment_orders_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_orders_order_id ON public.shipment_orders USING btree (order_id);


--
-- Name: idx_shipment_orders_shipment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shipment_orders_shipment_id ON public.shipment_orders USING btree (shipment_id);


--
-- Name: unique_roll_covering_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_roll_covering_sort_order ON public.roll_covering_composition USING btree (roll_covering_id, sort_order);


--
-- Name: products trigger_validate_surface_ids; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_validate_surface_ids BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_surface_ids();


--
-- Name: audit_log audit_log_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: cutting_operations cutting_operations_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: cutting_operations cutting_operations_operator_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_operator_id_users_id_fk FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- Name: cutting_operations cutting_operations_source_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_source_product_id_products_id_fk FOREIGN KEY (source_product_id) REFERENCES public.products(id);


--
-- Name: cutting_operations cutting_operations_target_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cutting_operations
    ADD CONSTRAINT cutting_operations_target_product_id_products_id_fk FOREIGN KEY (target_product_id) REFERENCES public.products(id);


--
-- Name: defect_products defect_products_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_products
    ADD CONSTRAINT defect_products_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: operation_reversals operation_reversals_audit_log_id_audit_log_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operation_reversals
    ADD CONSTRAINT operation_reversals_audit_log_id_audit_log_id_fk FOREIGN KEY (audit_log_id) REFERENCES public.audit_log(id);


--
-- Name: operation_reversals operation_reversals_reversed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operation_reversals
    ADD CONSTRAINT operation_reversals_reversed_by_users_id_fk FOREIGN KEY (reversed_by) REFERENCES public.users(id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_messages order_messages_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_messages order_messages_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: orders orders_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: product_relations product_relations_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_relations
    ADD CONSTRAINT product_relations_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_relations product_relations_related_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_relations
    ADD CONSTRAINT product_relations_related_product_id_products_id_fk FOREIGN KEY (related_product_id) REFERENCES public.products(id);


--
-- Name: production_queue production_queue_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_queue
    ADD CONSTRAINT production_queue_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: production_queue production_queue_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_queue
    ADD CONSTRAINT production_queue_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_task_extras production_task_extras_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_task_extras
    ADD CONSTRAINT production_task_extras_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_task_extras production_task_extras_task_id_production_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_task_extras
    ADD CONSTRAINT production_task_extras_task_id_production_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.production_tasks(id);


--
-- Name: production_tasks production_tasks_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_completed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_completed_by_users_id_fk FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: production_tasks production_tasks_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: production_tasks production_tasks_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_tasks production_tasks_started_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_tasks
    ADD CONSTRAINT production_tasks_started_by_users_id_fk FOREIGN KEY (started_by) REFERENCES public.users(id);


--
-- Name: products products_bottom_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_bottom_type_id_fkey FOREIGN KEY (bottom_type_id) REFERENCES public.bottom_types(id);


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_logo_id_product_logos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_logo_id_product_logos_id_fk FOREIGN KEY (logo_id) REFERENCES public.product_logos(id);


--
-- Name: products products_manager_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_manager_id_users_id_fk FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: products products_material_id_product_materials_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_material_id_product_materials_id_fk FOREIGN KEY (material_id) REFERENCES public.product_materials(id);


--
-- Name: products products_puzzle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_puzzle_type_id_fkey FOREIGN KEY (puzzle_type_id) REFERENCES public.puzzle_types(id);


--
-- Name: products products_surface_id_product_surfaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_surface_id_product_surfaces_id_fk FOREIGN KEY (surface_id) REFERENCES public.product_surfaces(id);


--
-- Name: role_permissions role_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: roll_covering_composition roll_covering_composition_carpet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roll_covering_composition
    ADD CONSTRAINT roll_covering_composition_carpet_id_fkey FOREIGN KEY (carpet_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: roll_covering_composition roll_covering_composition_roll_covering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roll_covering_composition
    ADD CONSTRAINT roll_covering_composition_roll_covering_id_fkey FOREIGN KEY (roll_covering_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: shipment_items shipment_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: shipment_items shipment_items_shipment_id_shipments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_shipment_id_shipments_id_fk FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);


--
-- Name: shipment_orders shipment_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_orders
    ADD CONSTRAINT shipment_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: shipment_orders shipment_orders_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipment_orders
    ADD CONSTRAINT shipment_orders_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;


--
-- Name: shipments shipments_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_movements stock_movements_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stock stock_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: telegram_notifications telegram_notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_notifications
    ADD CONSTRAINT telegram_notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: user_permissions user_permissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict blveAZ4yE3aov4Kttpd5S6nVrtA4i8uT4PJTlUJAD9aomlaFX1wosv5PoczIFNU

