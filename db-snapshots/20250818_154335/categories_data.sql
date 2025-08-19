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
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.categories (id, name, parent_id, path, description, sort_order, created_at, updated_at) FROM stdin;
1	Лежаки резиновые	\N	1	\N	0	2025-07-10 09:08:21.351216	2025-07-10 09:08:21.351216
2	Чешские (0 Чеш)	1	1.2	\N	0	2025-07-10 09:08:21.353927	2025-07-10 09:08:21.353927
3	3-Корончатые (3Кор)	1	1.3	\N	0	2025-07-10 09:08:21.356979	2025-07-10 09:08:21.356979
4	Брендовые	1	1.4	\N	0	2025-07-10 09:08:21.357735	2025-07-10 09:08:21.357735
5	GEA	4	1.4.5	\N	0	2025-07-10 09:08:21.358495	2025-07-10 09:08:21.358495
6	Agrotek	4	1.4.6	\N	0	2025-07-10 09:08:21.359274	2025-07-10 09:08:21.359274
7	Верблюд	4	1.4.7	\N	0	2025-07-10 09:08:21.359954	2025-07-10 09:08:21.359954
8	Коврики	\N	8	\N	0	2025-07-10 09:08:21.36056	2025-07-10 09:08:21.36056
9	Кольцевые	8	8.9	\N	0	2025-07-10 09:08:21.360925	2025-07-10 09:08:21.360925
10	Придверные	8	8.10	\N	0	2025-07-10 09:08:21.361283	2025-07-10 09:08:21.361283
11	Рулонные покрытия	\N	11	\N	0	2025-07-10 09:08:21.361645	2025-07-10 09:08:21.361645
12	Крепежные изделия	\N	12	\N	0	2025-07-10 09:08:21.36193	2025-07-10 09:08:21.36193
13	Дюбели	12	12.13	\N	0	2025-07-10 09:08:21.36223	2025-07-10 09:08:21.36223
14	Шип-6	8	8 / Шип-6	\N	0	2025-07-10 07:00:22.371	2025-07-10 07:00:22.392
\.


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.categories_id_seq', 15, true);


--
-- PostgreSQL database dump complete
--

