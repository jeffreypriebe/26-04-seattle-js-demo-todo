# Architecture Research

**Domain:** Mobile-first team todo / task management (React + Fastify + Postgres)
**Researched:** 2026-04-05
**Confidence:** HIGH (verified against official Fastify docs, TanStack Query docs, multiple practitioner sources)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Mobile Web)                     │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Auth UI   │  │ Personal   │  │  Team      │  │  Layout   │  │
│  │ (login/    │  │ Todos Page │  │ Tasks Page │  │ Shell /   │  │
│  │  signup)   │  │            │  │            │  │ Nav       │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        │               │               │               │         │
│  ┌─────▼───────────────▼───────────────▼───────────────▼──────┐  │
│  │              React Query (TanStack Query) Cache             │  │
│  │         useQuery / useMutation hooks per feature            │  │
│  └─────────────────────────┬───────────────────────────────────┘  │
│                             │                                      │
│  ┌──────────────────────────▼──────────────────────────────────┐  │
│  │               API Client (fetch wrapper / axios)             │  │
│  │          Attaches JWT access token; handles 401 refresh      │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              │  HTTPS REST
┌─────────────────────────────▼────────────────────────────────────┐
│                        Fastify API (Node.js)                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │               Global Plugins (registered at root)         │    │
│  │   @fastify/jwt · @fastify/cookie · @fastify/cors          │    │
│  │   postgres plugin (pg pool) · rate-limit                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐      │
│  │  /auth      │  │  /todos     │  │  /teams &            │      │
│  │  routes     │  │  routes     │  │  /team-tasks routes  │      │
│  │  plugin     │  │  plugin     │  │  plugin              │      │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘      │
│         │                │                     │                  │
│  ┌──────▼────────────────▼─────────────────────▼───────────────┐ │
│  │           Request Lifecycle (Fastify hook chain)             │ │
│  │  onRequest → preValidation → validation → preHandler →       │ │
│  │  handler → preSerialization → onSend                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬───────────────────────────────┘
                                   │  SQL (node-postgres / pg)
┌──────────────────────────────────▼───────────────────────────────┐
│                        PostgreSQL                                  │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  users   │  │  teams   │  │ team_members │  │    todos    │  │
│  └──────────┘  └──────────┘  └──────────────┘  └─────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React Pages | Route-level views; compose feature components | Vite + React Router v6 SPA |
| React Query hooks | Server state: fetching, caching, mutations, invalidation | `useQuery` / `useMutation` per feature |
| API client | HTTP transport; attaches auth header; catches 401 for refresh | `fetch` wrapper or `axios` instance |
| Auth context | Current user identity; JWT access token in memory | React Context + `useAuth()` hook |
| Fastify root app | Plugin registration, CORS, global error handler | `app.ts` with `fastify()` factory |
| Global plugins | Database pool, JWT config, cookie parser, rate limit | `plugins/` folder, each file exports one plugin |
| Route plugins | Route definitions + JSON Schema validation + handlers | `routes/<feature>/index.ts` |
| PostgreSQL | Durable persistence; enforces constraints and FKs | Managed via migration tool (e.g. `node-pg-migrate`) |

## Recommended Project Structure

### Backend (Fastify)

```
api/
├── src/
│   ├── app.ts              # Fastify factory, registers all plugins & routes
│   ├── plugins/            # Shared infrastructure (available app-wide)
│   │   ├── db.ts           # pg Pool, registered with fastify-plugin
│   │   ├── auth.ts         # @fastify/jwt + @fastify/cookie setup
│   │   └── cors.ts         # @fastify/cors config
│   ├── routes/             # Feature route plugins (encapsulated)
│   │   ├── auth/
│   │   │   ├── index.ts    # POST /auth/register, /auth/login, /auth/refresh, /auth/logout
│   │   │   └── schema.ts   # JSON Schema for request/response bodies
│   │   ├── todos/
│   │   │   ├── index.ts    # GET/POST/PATCH/DELETE /todos (personal, scoped to user)
│   │   │   └── schema.ts
│   │   ├── teams/
│   │   │   ├── index.ts    # GET/POST /teams, POST /teams/:id/members
│   │   │   └── schema.ts
│   │   └── team-tasks/
│   │       ├── index.ts    # GET/POST/PATCH/DELETE /teams/:id/tasks
│   │       └── schema.ts
│   └── db/
│       └── migrations/     # node-pg-migrate SQL migration files
├── package.json
└── tsconfig.json
```

### Frontend (React)

```
web/
├── src/
│   ├── main.tsx            # React root, QueryClientProvider, RouterProvider
│   ├── router.tsx          # React Router v6 route definitions
│   ├── api/                # HTTP transport layer
│   │   ├── client.ts       # Base fetch/axios instance with auth header injection
│   │   ├── auth.ts         # Auth API calls (login, register, refresh)
│   │   ├── todos.ts        # Personal todos API calls
│   │   └── teams.ts        # Teams + team tasks API calls
│   ├── features/           # Feature-scoped components + hooks
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── useAuth.ts  # Auth context consumer + mutations
│   │   ├── todos/
│   │   │   ├── TodoList.tsx
│   │   │   ├── TodoItem.tsx
│   │   │   ├── AddTodoForm.tsx
│   │   │   └── useTodos.ts # useQuery + useMutation wrappers
│   │   └── teams/
│   │       ├── TeamTaskList.tsx
│   │       ├── TeamTaskItem.tsx
│   │       ├── AddTeamTaskForm.tsx
│   │       └── useTeamTasks.ts
│   ├── components/         # Shared, reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Spinner.tsx
│   │   └── Layout.tsx      # Mobile shell: header + bottom nav
│   ├── context/
│   │   └── AuthContext.tsx # User identity + access token in memory
│   └── hooks/
│       └── useQueryClient.ts  # Shared query client instance
├── package.json
└── vite.config.ts
```

### Structure Rationale

- **api/:** Centralizes all HTTP calls. Components never call `fetch` directly — they use API functions or hooks. Enables easy mocking in tests and a single point for auth header injection.
- **features/:** Groups component + hook by domain. A developer working on todos touches only `features/todos/`. Avoids cross-feature coupling.
- **components/:** Only truly reusable primitives (Button, Input) live here — not feature components that happen to be shared.
- **plugins/ (backend):** Each plugin is independently testable and registered at the app root. The `fastify-plugin` wrapper bypasses Fastify's encapsulation so decorators (e.g., `fastify.db`) are available in all routes.

## Architectural Patterns

### Pattern 1: Fastify Plugin-First Organization

**What:** Every cross-cutting concern (database, auth, cors) is a Fastify plugin registered before routes. Routes are also plugins — scoped `register` calls — that receive shared decorators through the root scope.

**When to use:** Always with Fastify. The plugin system is the framework's core primitive and must be embraced, not worked around.

**Trade-offs:** Slight learning curve understanding encapsulation vs. `fastify-plugin`. Pays off immediately as routes stay clean and infra concerns are isolated.

**Example:**
```typescript
// plugins/db.ts
import fp from 'fastify-plugin'
import pg from 'pg'

export default fp(async (fastify) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  fastify.decorate('db', pool)
})

// app.ts
fastify.register(import('./plugins/db'))      // available everywhere
fastify.register(import('./routes/todos'), { prefix: '/todos' })
```

### Pattern 2: TanStack Query as Server State Manager

**What:** React Query owns all server-derived state. No Redux or Zustand for API data. Components call `useQuery` / `useMutation` hooks; the cache deduplicates requests and handles background refresh.

**When to use:** Whenever a React component needs data from the API. Replaces manual `useEffect` + `useState` patterns for data fetching.

**Trade-offs:** Adds a dependency and QueryClient setup, but eliminates entire categories of loading/error/stale state bugs. For a CRUD app of this scope it is the right level of abstraction.

**Example:**
```typescript
// features/todos/useTodos.ts
export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: () => apiClient.get('/todos'),
  })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => apiClient.post('/todos', { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })
}
```

### Pattern 3: JWT Access Token in Memory + Refresh Token in httpOnly Cookie

**What:** The access token (short-lived, 15 min) is stored in JS memory (React Context). The refresh token is stored in an httpOnly cookie scoped to `/auth/refresh`. On 401, the API client silently calls `/auth/refresh` before retrying.

**When to use:** Any app using JWTs with browser clients. Avoids localStorage XSS risk while still supporting token refresh.

**Trade-offs:** Token lost on page refresh — requires a `/auth/me` call on app boot to restore session from cookie. Slightly more complex than localStorage but meaningfully more secure.

## Data Flow

### Request Flow (creating a todo)

```
User taps "Add" button
    ↓
AddTodoForm (React) calls mutate()
    ↓
useMutation → apiClient.post('/todos', { title })
    ↓ (Authorization: Bearer <access-token>)
Fastify route handler → JSON Schema validation
    ↓
Handler queries db: INSERT INTO todos ... RETURNING *
    ↓
Fastify serializes response via JSON Schema
    ↓
React Query: onSuccess → invalidateQueries(['todos'])
    ↓
TodoList re-fetches → cache updated → UI re-renders
```

### Authentication Flow

```
App boots → /auth/me with httpOnly cookie
    ↓
Success: set user in AuthContext, store access token in memory
Failure: redirect to /login
    ↓
User logs in → POST /auth/login
    ↓
API sets refresh token cookie + returns access token in body
    ↓
AuthContext stores access token in memory
    ↓
All API calls attach: Authorization: Bearer <access-token>
    ↓
On 401 → apiClient calls /auth/refresh (sends httpOnly cookie)
    ↓
New access token returned → retry original request
```

### State Management

```
AuthContext (React Context)
    ↓ provides { user, accessToken, login, logout }
Protected Routes / Feature components
    ↓
useQuery/useMutation hooks (TanStack Query)
    ↓ server state: todos, team tasks, team members
QueryClient cache
    ↓ invalidated after mutations → triggers refetch
```

### Key Data Flows

1. **Personal todos isolation:** `GET /todos` query always filters `WHERE user_id = $1` using the authenticated user from the JWT. No cross-user leakage possible at the DB layer.
2. **Team task visibility:** `GET /teams/:id/tasks` first checks membership in `team_members` before returning results. Unauthorized team members receive 403.
3. **Token refresh:** The API client intercepts 401 responses, calls `/auth/refresh` once, updates the in-memory token, and retries the failed request transparently.

## Key Data Models

### users
```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,          -- Argon2id hash
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### teams
```sql
CREATE TABLE teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### team_members (junction)
```sql
CREATE TABLE team_members (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
```

### todos (personal)
```sql
CREATE TABLE todos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### team_tasks (shared pool)
```sql
CREATE TABLE team_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Model notes:**
- Personal todos and team tasks are separate tables — this keeps queries simple and prevents accidental visibility leakage.
- `team_members` composite PK ensures a user cannot be added to the same team twice (enforced at the DB level, not just in application code).
- `team_tasks.created_by` records who created a task but does not enforce ownership — any team member can complete or delete any team task (per scope: no task assignment in v1).
- Argon2id is the recommended password hashing algorithm (NIST-endorsed, memory-hard, GPU-resistant). Use `argon2` npm package.

## REST API Endpoint Map

```
POST   /auth/register          Create user account
POST   /auth/login             Return access token + set refresh cookie
POST   /auth/refresh           Exchange refresh cookie → new access token
POST   /auth/logout            Clear refresh cookie

GET    /todos                  List authenticated user's todos
POST   /todos                  Create a personal todo
PATCH  /todos/:id              Update title or completed status
DELETE /todos/:id              Delete a personal todo

GET    /teams                  List teams the user belongs to
POST   /teams                  Create a team
POST   /teams/:id/members      Add a user to a team (by email)

GET    /teams/:id/tasks        List team tasks (members only)
POST   /teams/:id/tasks        Create a team task
PATCH  /teams/:id/tasks/:tid   Update a team task
DELETE /teams/:id/tasks/:tid   Delete a team task
```

## Suggested Build Order (Phase Dependencies)

Building in this order avoids blocked work:

1. **Database schema + migrations** — Everything depends on the data model. Define tables, set up `node-pg-migrate`, and wire the `pg` pool into Fastify first.
2. **Auth routes + middleware** — JWT-protected routes require auth infrastructure. Build register/login/refresh before any protected endpoint.
3. **Personal todos CRUD** — Simplest protected resource. Validates the full stack (auth → route → DB → response) end-to-end.
4. **React app shell + auth UI** — Once the API is functional, build login/signup flows and the mobile layout shell.
5. **Frontend todos feature** — Wire personal todos to the React UI with TanStack Query hooks.
6. **Team management** — More complex (membership checks, junction table). Build after the simpler solo flows are stable.
7. **Team tasks feature** — Depends on teams existing. Build last.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users | Monolith is fine; single Postgres instance; no caching needed |
| 100-10k users | Add DB connection pooling (PgBouncer); add index on `todos.user_id` and `team_tasks.team_id` |
| 10k+ users | Consider read replica; add Redis for session/token revocation list; evaluate CDN for static assets |

### Scaling Priorities

1. **First bottleneck:** Unindexed queries on `todos.user_id` / `team_tasks.team_id` as rows grow. Add these indexes immediately — they cost nothing at small scale and prevent full-table scans.
2. **Second bottleneck:** Node.js event loop under concurrent load. Fastify's schema-based serialization delays this significantly; horizontal scaling (multiple Node processes behind a load balancer) is the lever.

## Anti-Patterns

### Anti-Pattern 1: Storing JWT Access Token in localStorage

**What people do:** `localStorage.setItem('token', accessToken)` for convenience.
**Why it's wrong:** Any XSS vulnerability in a dependency can exfiltrate the token. For a team app, this means all users' sessions are compromised.
**Do this instead:** Store access token in React Context (memory only). Store refresh token in an httpOnly, Secure, SameSite=Strict cookie.

### Anti-Pattern 2: Skipping JSON Schema Validation on Fastify Routes

**What people do:** Write route handlers that access `req.body.title` without a schema declaration.
**Why it's wrong:** Fastify's serialization and performance gains depend on compiled schemas. Without them, you lose type safety, input validation, and fast response serialization.
**Do this instead:** Define a JSON Schema (or TypeBox schema) for every route's body, params, querystring, and response. Validation runs before your handler and rejects bad input automatically.

### Anti-Pattern 3: Mixing Personal and Team Todos in One Table

**What people do:** Add a nullable `team_id` column to a single `todos` table. If `team_id` is null, it's personal; if set, it's a team task.
**Why it's wrong:** Access control becomes complex (every query needs to handle both cases), and the schema is ambiguous. You end up with multiple `WHERE` clause branches and risk cross-visibility bugs.
**Do this instead:** Use separate `todos` (personal) and `team_tasks` (shared) tables with distinct access control paths.

### Anti-Pattern 4: Calling `fetch` Directly in React Components

**What people do:** `useEffect(() => { fetch('/todos').then(...) }, [])` inside a component.
**Why it's wrong:** No deduplication, no caching, race conditions on unmount, loading/error state reimplemented everywhere.
**Do this instead:** Put all fetch calls in `api/*.ts` service functions and call them through TanStack Query hooks.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React features ↔ API | Via `api/*.ts` service functions only | No `fetch` in components |
| API client ↔ Fastify | HTTPS REST, JSON bodies | Auth header on every non-public request |
| Fastify routes ↔ Postgres | `pg` pool via `fastify.db` decorator | Parameterized queries only (no string interpolation) |
| Auth plugin ↔ routes | `fastify.authenticate` pre-handler hook | Registered globally via `fastify-plugin` |

## Sources

- [Fastify Plugin Guide (official)](https://fastify.dev/docs/latest/Guides/Plugins-Guide/) — HIGH confidence
- [Fastify Routes Reference (official)](https://fastify.dev/docs/latest/Reference/Routes/) — HIGH confidence
- [TanStack Query Overview (official)](https://tanstack.com/query/latest/docs/framework/react/overview) — HIGH confidence
- [Backend with Fastify — Project Structure (codingmountain)](https://medium.com/codingmountain-blog/backend-with-fastify-part-5-fastify-concepts-project-structure-custom-plugins-login-route-3c251a6f33d0) — MEDIUM confidence
- [React Folder Structure in 5 Steps — Robin Wieruch](https://www.robinwieruch.de/react-folder-structure/) — MEDIUM confidence
- [JWT Refresh Token Pattern (DEV.to)](https://dev.to/devforgedev/jwt-refresh-token-rotation-in-nodejs-the-complete-implementation-2f2b) — MEDIUM confidence
- [Password Hashing 2025: Argon2 vs Bcrypt](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) — MEDIUM confidence
- [Database Schema Design (PostGraphile)](https://postgraphile.org/postgraphile/4/postgresql-schema-design/) — MEDIUM confidence

---
*Architecture research for: Mobile-first team todo app (React + Fastify + Postgres)*
*Researched: 2026-04-05*
