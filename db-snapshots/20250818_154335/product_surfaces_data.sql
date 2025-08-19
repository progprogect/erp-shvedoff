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
-- Data for Name: product_surfaces; Type: TABLE DATA; Schema: public; Owner: mikitavalkunovich
--

COPY public.product_surfaces (id, name, description, is_system, created_at) FROM stdin;
1	Чешуйки	Поверхность с рисунком в виде чешуек	t	2025-07-11 12:13:03.758852
2	Черточки	Поверхность с рисунком в виде черточек	t	2025-07-11 12:13:03.758852
3	Одна коровка	Поверхность с одним логотипом коровки	t	2025-07-11 12:13:03.758852
4	Три коровки	Поверхность с тремя логотипами коровок	t	2025-07-11 12:13:03.758852
5	Лого	Поверхность с логотипом (требует указания конкретного логотипа)	t	2025-07-11 12:13:03.758852
18	Гладкая	Гладкая поверхность без рисунка	t	2025-07-22 15:19:08.425401
19	1 коровка	Поверхность с одним логотипом коровки	t	2025-07-22 15:19:08.425401
20	3 коровки	Поверхность с тремя логотипами коровок	t	2025-07-22 15:19:08.425401
21	Чешуйка с лого	Поверхность с чешуйками и логотипом	t	2025-07-22 15:19:08.425401
23	Паззл	Поверхность с паззловой текстурой и дополнительными опциями	t	2025-07-23 09:28:25.929839
\.


--
-- Name: product_surfaces_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mikitavalkunovich
--

SELECT pg_catalog.setval('public.product_surfaces_id_seq', 23, true);


--
-- PostgreSQL database dump complete
--

