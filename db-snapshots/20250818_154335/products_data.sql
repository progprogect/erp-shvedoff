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
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.products (id, name, article, category_id, dimensions, characteristics, tags, price, cost_price, norm_stock, notes, photos, is_active, created_at, updated_at, surface_id, logo_id, material_id, manager_id, puzzle_options, mat_area, weight, grade, border_type) FROM stdin;
1	Тест	ТЕС-100x120x10	9	{"width": 120, "length": 100, "thickness": 10}	\N	\N	1000.00	\N	100	\N	\N	t	2025-07-28 15:40:15.750456	2025-07-31 15:29:07.293	23	\N	2	\N	{"type": "супер_узкий", "sides": "4_sides", "enabled": true}	0.0120	5.000	grade_2	\N
2	Лежак Новый	ЛЕЖАК-НОВЫ-100x100x5-ДРОБ-ПАЗЗ-СБОРТ-VELES-2СОРТ	10	{"width": 100, "length": 100, "thickness": 5}	\N	\N	\N	\N	200	\N	\N	t	2025-08-01 13:53:02.864091	2025-08-01 13:53:02.864091	23	9	2	\N	{"type": "wide", "sides": "1_side", "enabled": true}	0.0100	\N	grade_2	\N
\.


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.products_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

