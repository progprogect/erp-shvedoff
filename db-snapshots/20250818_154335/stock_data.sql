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
-- Data for Name: stock; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.stock (id, product_id, current_stock, reserved_stock, updated_at) FROM stdin;
2	2	50	50	2025-08-01 10:54:59.13
1	1	380	0	2025-08-01 10:55:30.569
\.


--
-- Name: stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.stock_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

