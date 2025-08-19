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
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.stock_movements (id, product_id, movement_type, quantity, reference_id, reference_type, comment, user_id, created_at) FROM stdin;
1	1	incoming	200	\N	initial_stock	Начальное оприходование при создании товара	1	2025-07-28 12:40:15.856
2	1	adjustment	100	\N	\N	Корректировка остатка через карточку товара	1	2025-07-28 15:44:54.211229
3	1	incoming	20	1	production_task	Частичное производство (задание #1 - завершено)	1	2025-07-28 15:50:36.71743
4	1	incoming	10	2	production_task	Частичное производство (задание #2)	1	2025-07-28 20:20:07.979941
5	2	incoming	50	\N	initial_stock	Начальное оприходование при создании товара	1	2025-08-01 10:53:02.919
6	2	reservation	50	1	order	\N	1	2025-08-01 13:54:59.134696
7	1	incoming	50	2	production_task	Производство завершено (задание #2)	1	2025-08-01 13:55:30.561335
\.


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 7, true);


--
-- PostgreSQL database dump complete
--

