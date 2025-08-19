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
-- Data for Name: product_materials; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.product_materials (id, name, description, is_system, created_at) FROM stdin;
1	Протектор	Материал протектор для резиновых изделий	t	2025-07-11 12:19:51.333129
2	Дробленка	Материал дробленка для резиновых изделий	t	2025-07-11 12:19:51.333129
\.


--
-- Name: product_materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.product_materials_id_seq', 4, true);


--
-- PostgreSQL database dump complete
--

