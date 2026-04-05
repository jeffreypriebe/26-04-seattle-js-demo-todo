# Team Todo App

## What This Is

A mobile-first todo tracking application for small teams. Users can manage their own personal task lists and collaborate on shared team tasks. Built with a React frontend, Node/Fastify API, and SQLite database for persistence.

## Core Value

Every task gets saved and stays in sync — personal todos and shared team tasks reliably persisted and accessible on mobile.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User authentication (sign up, log in, log out)
- [ ] Personal todo list per user (create, complete, delete tasks)
- [ ] Shared team task pool (visible and manageable by all team members)
- [ ] Mobile-first responsive UI in React
- [ ] REST API via Node/Fastify
- [ ] Data persistence in SQLite

### Out of Scope

- Native mobile app (iOS/Android) — mobile web is sufficient
- Real-time live updates (websockets) — not required for v1
- Third-party integrations (Slack, email, etc.) — keep scope tight
- Task assignment / ownership on shared tasks — deferred to future

## Context

- Learning-focused project: the stack choices (React, Fastify, Postgres) are intentional
- Small team use case: a handful of people, not a SaaS product
- Mobile web primary target: layout and interactions optimized for phone screens
- Two task modes: personal (private per user) and shared (team-visible)

## Constraints

- **Tech Stack**: React (frontend), Node/Fastify (API), SQLite (database) — chosen intentionally
- **Target**: Mobile web browser — no native app
- **Scope**: v1 is CRUD + auth only — no advanced features

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fastify over Express | Faster, schema-first REST; better learning of modern Node patterns | — Pending |
| Mobile-first web | Broadest reach without native app complexity | — Pending |
| Both personal + shared task pools | Supports real small-team workflows | — Pending |
| Drizzle ORM over TypeORM/Prisma | TypeScript-native schema-as-code, SQL-like API, no code generation step, 5KB bundle | — Pending |
| shadcn/ui + Tailwind CSS v4 | Copy-into-codebase components, accessible by default, mobile touch targets built-in | — Pending |
| TanStack Query for server state | Optimistic updates keep mobile UX snappy; best-in-class mutation lifecycle for todo apps | — Pending |
| @fastify/jwt + bcryptjs for auth | Official Fastify plugin, access token in memory + refresh in HttpOnly cookie; no OAuth needed for v1 | — Pending |
| Zod for shared validation | Single schema definition used on both frontend (forms) and backend (request validation) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after stack decisions finalized*
