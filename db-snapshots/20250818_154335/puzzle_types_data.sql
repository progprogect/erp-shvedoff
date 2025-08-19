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
-- Data for Name: puzzle_types; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.puzzle_types (id, name, code, description, is_system, created_at) FROM stdin;
1	Старый	old	Стандартный старый тип паззла	t	2025-07-23 12:20:05.342176
2	Старый 04.2025	old_04_2025	Обновленная версия старого типа паззла	t	2025-07-23 12:20:05.342176
3	Новый	new	Новый тип паззла с улучшенными характеристиками	t	2025-07-23 12:20:05.342176
4	Узкий	narrow	Узкий паззл для специальных применений	t	2025-07-23 12:20:05.342176
5	Широкий	wide	Широкий паззл для больших площадей	t	2025-07-23 12:20:05.342176
6	Супер узкий	супер_узкий	Новый тип для тестирования	f	2025-07-23 09:23:04.648
\.


--
-- Name: puzzle_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.puzzle_types_id_seq', 6, true);


--
-- PostgreSQL database dump complete
--

