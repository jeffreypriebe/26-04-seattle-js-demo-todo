# Project Research Summary

**Project:** Team Todo App
**Domain:** Mobile-first personal + shared team task management (React + Fastify + Postgres)
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

This is a mobile-first CRUD application with two distinct task pools — private per-user todos and shared team tasks — backed by JWT-authenticated REST API. Experts build this pattern with a clear separation between personal and team data at the database layer (two separate tables, not a nullable team_id column), a plugin-first Fastify API with schema validation on every route, and TanStack Query managing all server state on the frontend. The stack (React 19 + Vite + Fastify 5 + Drizzle ORM + Postgres) is modern, well-supported, and well-matched to the project scope.

The recommended approach is to build in strict dependency order: database schema first, then auth infrastructure, then personal todos as the simplest end-to-end flow, then the React shell, and finally team features last since they depend on everything before them. Optimistic updates via TanStack Query are the key UX differentiator for a mobile-first app — the UI must feel instant even on slow cell connections. Shared components (Zod schemas, TypeScript types) between frontend and backend eliminate the most common source of drift in full-stack TypeScript projects.

The two biggest risks in this project are both security-related and must be addressed before any route is shipped: (1) missing ownership checks that allow any authenticated user to access any other user's data (BOLA), and (2) JWT tokens stored in localStorage which are trivially stolen via XSS. Both are cheap to prevent at the start and very expensive to retrofit. A third risk specific to mobile is the virtual keyboard covering fixed-bottom input fields — testable immediately with browser DevTools mobile simulation and fixed with a one-line CSS change to `dvh` units.

## Key Findings

### Recommended Stack

The stack is fully specified and all versions are verified against npm as of 2026-04-05. React 19 + Vite 8 on the frontend, Fastify 5 + Drizzle ORM on the backend, with Zod shared across both layers for schema validation. TanStack Query handles server state; React Hook Form handles form state. shadcn/ui with Tailwind CSS v4 provides the UI component layer. The most important version compatibility constraints are: fastify-type-provider-zod must be v6.x for Fastify v5, all `@fastify/*` plugins must be at their v10/v11 major versions, and shadcn/ui must not mix Tailwind v3 components with a v4 setup.

**Core technologies:**
- **React 19 + Vite 8**: UI framework + build tool — fastest non-Next.js React setup; Actions API simplifies mutations
- **TypeScript 6**: Type safety across frontend and backend — single language, improved inference
- **Fastify 5 + fastify-type-provider-zod**: API framework — schema-first, 2x faster than Express, Zod integration gives end-to-end type inference
- **Drizzle ORM 0.45 + postgres.js**: Database layer — TypeScript-native schema-as-code, no code generation, fastest pure-JS Postgres driver
- **TanStack Query 5**: Server state management — best-in-class caching and mutation lifecycle for CRUD apps; optimistic updates are first-class
- **Zod 4**: Shared validation — single source of truth for data shapes used in both API routes and frontend forms
- **shadcn/ui + Tailwind CSS v4**: UI components — copy-into-codebase model, accessible by default via Radix primitives, touch-friendly 44px targets

### Expected Features

Research confirms the core MVP is well-scoped. The feature gap this app fills is real: Todoist covers personal + shared tasks but its mobile web experience lags its native apps; Things 3 is personal-only; Linear is engineering-workflow-specific. A focused mobile-web-first personal + shared task app has clear differentiation at v1.

**Must have (table stakes):**
- User authentication (sign up, log in, log out) — identity boundary required for all scope
- Personal task CRUD (create, complete, delete) — the core product loop
- Shared team task pool (CRUD visible to all team members) — the collaboration differentiator
- Mobile-first responsive UI with bottom navigation and 44px touch targets — primary device is a phone
- Creator name shown on shared tasks — minimal ownership signal without full assignment
- Empty states for both lists — new users need guidance
- Task ordering by created_at or manual — users need to prioritize

**Should have (competitive):**
- Optimistic UI updates — mobile UX differentiator; tasks must feel instant on slow connections
- Due date storage and display (no notifications) — low-complexity addition once CRUD is stable
- Swipe-to-complete / swipe-to-delete gestures — power-user mobile shortcut
- Completion activity counter — lightweight positive reinforcement

**Defer (v2+):**
- Task assignment on shared tasks — requires user directory, notifications, ownership semantics
- Push notification reminders — service worker + permissions infrastructure
- Real-time updates (WebSockets) — acceptable to poll or refresh on tab focus for v1 team size
- Sub-tasks, priority levels, third-party integrations — explicitly out of scope per PROJECT.md

### Architecture Approach

The architecture follows Fastify's plugin-first pattern: database pool, JWT config, and CORS are registered as global plugins before routes; route groups (auth, todos, teams, team-tasks) are encapsulated plugins that receive shared decorators. On the frontend, the `features/` folder groups component + hook by domain so a developer working on todos touches only `features/todos/`. All HTTP calls flow through `api/*.ts` service functions — no `fetch` calls in components. Auth state (JWT access token) lives in React Context memory only; the refresh token lives in an HttpOnly cookie.

**Major components:**
1. **React pages + feature hooks** — Route-level views; TanStack Query `useQuery`/`useMutation` per feature domain
2. **API client (`api/client.ts`)** — Single fetch wrapper; attaches Bearer token; intercepts 401 for silent token refresh
3. **Auth context** — In-memory access token + current user; restored on app boot via `/auth/me` using the httpOnly cookie
4. **Fastify root app + global plugins** — `@fastify/jwt`, `@fastify/cors`, Drizzle DB client registered before all routes
5. **Route plugins (auth, todos, teams, team-tasks)** — Encapsulated Fastify plugins with Zod schemas on every request/response
6. **PostgreSQL (4 tables)** — `users`, `teams`, `team_members` (junction), `todos` (personal), `team_tasks` (shared)

The data model uses separate `todos` and `team_tasks` tables — not a nullable `team_id` on a single table — which keeps access control clean and prevents cross-visibility bugs. Every personal todo query scopes by `user_id` from the JWT. Every team task query joins against `team_members` to verify membership.

### Critical Pitfalls

1. **BOLA / Missing ownership checks** — Always scope queries by JWT-derived `user_id`: `WHERE id = $1 AND user_id = $2`. Never fetch by ID alone. Establish this pattern before the first route is shipped; retrofitting is expensive.
2. **JWT in localStorage** — Store access token in React Context memory only. Store refresh token in `HttpOnly; Secure; SameSite=Strict` cookie. Implement `/auth/refresh` endpoint and 401-interceptor in the API client before building protected routes.
3. **No team membership check on shared task endpoints** — Every `GET/POST/PATCH/DELETE /teams/:id/tasks` must join against `team_members` to verify the requester belongs to that team. `team_id` must never be trusted from the request body.
4. **Virtual keyboard covering mobile input fields** — Use `100dvh` instead of `100vh` for full-height containers. Call `scrollIntoView()` on input focus. Test on iOS Safari and Android Chrome DevTools before any UI phase is considered done.
5. **Schema-less Fastify routes** — Define Zod schemas for every route's `body`, `params`, and `querystring` from the first endpoint. Fastify's performance and type safety both depend on compiled schemas. Never skip this.

## Implications for Roadmap

Based on research, the build order is dictated by hard dependencies: auth gates everything; personal todos are the simplest complete flow to validate the stack; team features depend on auth and a working CRUD pattern existing first. Seven phases are suggested.

### Phase 1: Database Foundation

**Rationale:** Every phase depends on the data model. Schema decisions made here (separate tables, timestamps on every table, indexes on foreign keys) are expensive to change later. Zero-cost prevention of three critical pitfalls.
**Delivers:** Postgres schema with all 5 tables, Drizzle ORM setup, drizzle-kit migrations, Docker Compose for local Postgres
**Addresses:** Establishes separate `todos` / `team_tasks` tables (avoids mixed-table anti-pattern); `created_at`/`updated_at` on all tables; `user_id` and `team_id` indexes
**Avoids:** Missing timestamps pitfall; mixed personal/team table pitfall; unindexed foreign key queries

### Phase 2: Authentication

**Rationale:** Auth is a prerequisite for every protected endpoint. JWT storage strategy and refresh token flow must be established here — they cannot be retrofitted after protected routes exist.
**Delivers:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`; bcrypt password hashing (cost 12); httpOnly refresh token cookie; in-memory access token pattern
**Addresses:** User authentication (table stakes feature)
**Avoids:** JWT-in-localStorage pitfall; weak password hashing pitfall; missing refresh token flow pitfall; rate limiting on auth endpoints

### Phase 3: Personal Todos API

**Rationale:** Simplest protected resource — validates the full stack (auth middleware → route → DB → response) end-to-end before adding team complexity. Establishes ownership-scoped query pattern.
**Delivers:** `GET/POST/PATCH/DELETE /todos` — full personal task CRUD, scoped to authenticated user
**Addresses:** Personal task list (table stakes feature)
**Avoids:** BOLA ownership check pattern established here for all subsequent routes

### Phase 4: React App Shell + Auth UI

**Rationale:** Frontend can now be built against a working API. Mobile layout shell and auth flows are the prerequisite for all frontend feature work.
**Delivers:** Vite + React 19 + React Router setup; login/signup forms (React Hook Form + Zod); AuthContext with token refresh interceptor; mobile layout shell (bottom nav, `dvh` units, 44px touch targets); QueryClientProvider
**Addresses:** Mobile-first responsive UI (table stakes); empty states
**Avoids:** Virtual keyboard overlap pitfall (dvh units from the start); hover-only interactions; form full-page reload

### Phase 5: Personal Todos Frontend

**Rationale:** First complete user-facing feature. Validates TanStack Query patterns (optimistic updates, cache invalidation) that all subsequent features will reuse.
**Delivers:** Personal todo list UI — add, complete, delete; TanStack Query hooks with optimistic updates; loading and error states; empty state
**Addresses:** Personal task CRUD with instant mobile feedback (differentiator)
**Avoids:** Re-fetching full list after every mutation; no loading state on async operations

### Phase 6: Team Management

**Rationale:** Team features require a working team concept before team tasks can exist. Build the simpler team management endpoints first, then layer tasks on top.
**Delivers:** `GET/POST /teams`, `POST /teams/:id/members`; team selection UI; team membership stored and validated server-side
**Addresses:** Shared team task pool prerequisite (workspace concept)
**Avoids:** Team membership authorization pitfall — membership check pattern established here

### Phase 7: Team Tasks

**Rationale:** Last phase because it depends on everything before it: auth, personal CRUD patterns, team membership. Completes the core value proposition.
**Delivers:** `GET/POST/PATCH/DELETE /teams/:id/tasks`; team task list UI with creator name display; tab navigation between personal and team views; visual distinction between task pools
**Addresses:** Shared team task pool (table stakes); creator ownership signal (differentiator)
**Avoids:** Cross-team data exposure (team membership join in every query)

### Phase Ordering Rationale

- **Schema before everything:** Three pitfalls (missing timestamps, mixed tables, missing indexes) are zero-cost to prevent at schema creation time and expensive to fix after data exists.
- **Auth before protected routes:** JWT storage strategy and refresh flow cannot be retrofitted. Every route built without auth established will need revisiting.
- **Backend feature before frontend feature:** Building the API endpoint and validating it with curl/Postman before building the UI keeps the layers decoupled and makes debugging cleaner.
- **Personal todos before team todos:** Personal todos have no authorization complexity beyond user_id scoping. They validate the full request lifecycle pattern cleanly.
- **Team management before team tasks:** Team tasks require a `team_id` foreign key that references a team that exists. The team creation flow must work before tasks can be assigned to it.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Authentication):** Refresh token rotation vs. simple refresh — research the tradeoffs for this app's threat model; `@fastify/jwt` multi-token setup has limited examples in the wild
- **Phase 4 (React Shell):** `dvh` browser support across iOS Safari versions may need a fallback strategy; verify current support matrix

Phases with standard patterns (skip research-phase):
- **Phase 1 (Database):** Drizzle ORM setup and migration workflow is well-documented; table design is straightforward
- **Phase 3 (Personal Todos API):** Standard Fastify CRUD with Zod schemas — fully documented, no unknowns
- **Phase 5 (Personal Todos Frontend):** TanStack Query optimistic update pattern for CRUD is extensively documented
- **Phase 6 (Team Management):** Junction table patterns are standard; Fastify route plugins well-understood by this phase
- **Phase 7 (Team Tasks):** Same patterns as Phase 3/5, applied to team-scoped data

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry 2026-04-05; compatibility matrix explicitly checked |
| Features | MEDIUM | Competitor analysis from public docs and reviews; no user interviews; MVP scope aligns with PROJECT.md constraints |
| Architecture | HIGH | Verified against official Fastify and TanStack Query docs; practitioner sources corroborate patterns |
| Pitfalls | HIGH | Most pitfalls verified via multiple sources including OWASP, official docs, and CVE reports |

**Overall confidence:** HIGH

### Gaps to Address

- **Team invite flow UX:** Research covers the data model (add member by email) but the specific UI flow for inviting a teammate is not detailed. Decide during Phase 6 planning: invite link vs. email-lookup form.
- **Optimistic update rollback UX:** TanStack Query handles the rollback mechanism, but what the user sees when a mutation fails (toast? inline error?) needs a decision before Phase 5.
- **Connection pooling for deployment target:** Drizzle + postgres.js works well for direct connections; if deploying to a PaaS with ephemeral instances (Render, Railway, Fly.io), confirm whether PgBouncer or a connection limiter is needed at the expected team size.
- **Argon2id vs bcrypt:** ARCHITECTURE.md recommends Argon2id (NIST-endorsed, memory-hard) while STACK.md recommends bcryptjs (pure JS, no native compilation). Decide before Phase 2: Argon2id is more secure but requires native compilation; bcryptjs is safer for deployment simplicity. Document the tradeoff explicitly in the auth phase.

## Sources

### Primary (HIGH confidence)
- npm registry (direct fetch, 2026-04-05) — all version numbers verified
- [Fastify Plugin Guide (official)](https://fastify.dev/docs/latest/Guides/Plugins-Guide/) — plugin-first architecture patterns
- [Fastify Routes Reference (official)](https://fastify.dev/docs/latest/Reference/Routes/) — route schema patterns
- [TanStack Query Overview (official)](https://tanstack.com/query/latest/docs/framework/react/overview) — server state management patterns
- [Fastify Validation and Serialization (official)](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) — schema validation
- [OWASP API Security Top 10: BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — ownership check patterns
- [shadcn/ui Tailwind v4 migration guide](https://ui.shadcn.com/docs/tailwind-v4) — component compatibility
- [Drizzle ORM PostgreSQL docs](https://orm.drizzle.team/docs/get-started-postgresql) — driver recommendations

### Secondary (MEDIUM confidence)
- [Drizzle vs Prisma 2026 — makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — ORM comparison
- [TanStack Query vs SWR 2025 — refine.dev](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/) — data fetching comparison
- [JWT Refresh Token Rotation in Node.js — DEV.to](https://dev.to/devforgedev/jwt-refresh-token-rotation-in-nodejs-the-complete-implementation-2f2b) — refresh token pattern
- [Password Hashing 2025: Argon2 vs Bcrypt — guptadeepak.com](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) — hashing algorithm tradeoffs
- [Concurrent Optimistic Updates in React Query — tkdodo.eu](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query) — optimistic update patterns
- [Fix mobile keyboard overlap with VisualViewport — DEV Community](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a) — dvh / keyboard handling
- [Node-Postgres Connection Pooling — node-postgres.com](https://node-postgres.com/features/pooling) — pool configuration
- [Fastify CVE-2025-32442 — Snyk](https://security.snyk.io/vuln/SNYK-JS-FASTIFY-9788069) — input validation security note

### Tertiary (MEDIUM-LOW confidence)
- [Todoist Features](https://www.todoist.com/features), [TechRadar Best Task Apps 2026](https://www.techradar.com/best/best-task-management-apps-of-year), [Zapier Best To-Do Apps 2026](https://zapier.com/blog/best-todo-list-apps/) — competitor feature analysis (public docs, no hands-on testing)
- [Elaris Mobile UX Thumb Zones 2025](https://elaris.software/blog/mobile-ux-thumb-zones-2025/) — 44px touch target standard

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
