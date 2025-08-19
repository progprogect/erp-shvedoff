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
-- Data for Name: product_logos; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.product_logos (id, name, description, is_system, created_at) FROM stdin;
1	Велес	Логотип бренда Велес	t	2025-07-11 12:16:22.007609
2	Геа	Логотип бренда Геа	t	2025-07-11 12:16:22.007609
3	Агротек	Логотип бренда Агротек	t	2025-07-11 12:16:22.007609
7	GEA	Логотип бренда GEA	t	2025-07-22 15:19:08.432449
8	Maximilk	Логотип бренда Maximilk	t	2025-07-22 15:19:08.432449
9	VELES	Логотип бренда VELES	t	2025-07-22 15:19:08.432449
11	Арнтьен	Логотип бренда Арнтьен	t	2025-07-22 15:19:08.432449
\.


--
-- Name: product_logos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.product_logos_id_seq', 11, true);


--
-- PostgreSQL database dump complete
--

