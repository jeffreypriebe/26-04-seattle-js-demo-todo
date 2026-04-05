# Pitfalls Research

**Domain:** Mobile-first React + Fastify + Postgres team todo app (auth + shared data)
**Researched:** 2026-04-05
**Confidence:** HIGH (most pitfalls verified via multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Missing Ownership Checks on Every API Endpoint (BOLA/IDOR)

**What goes wrong:**
The API authenticates the user (confirms who they are) but does not verify they own the resource they are accessing. `GET /api/todos/:id` fetches the todo by ID without checking if `todo.user_id` matches the authenticated user. One user can read, update, or delete another user's personal todos just by guessing or iterating IDs.

**Why it happens:**
Authentication is implemented centrally (JWT middleware), so developers assume authorization is handled. The leap from "logged in" to "authorized to touch this record" is manual and easy to skip when focused on feature completion.

**How to avoid:**
Always scope queries by the authenticated user's identity — never fetch by ID alone. Pattern: `SELECT * FROM todos WHERE id = $1 AND user_id = $2`. Derive `user_id` from the JWT claim on the server, never from request body or params. For shared team tasks, check team membership in the query, not just in application code logic.

**Warning signs:**
- API handlers that call `findById(req.params.id)` without a second condition
- Tests that verify data is returned but don't test cross-user access
- No test asserting that User A cannot access User B's data

**Phase to address:**
Auth + API setup phase. Establish the ownership-scoped query pattern before any CRUD endpoints are built — retrofitting is expensive.

---

### Pitfall 2: JWT Stored in localStorage — XSS Attack Surface

**What goes wrong:**
JWT access tokens stored in `localStorage` are readable by any JavaScript running on the page. A single XSS vulnerability — in your code, a dependency, or a browser extension — exposes every stored token. The attacker can impersonate users silently.

**Why it happens:**
`localStorage` is simple and works immediately. Cookies require more server-side setup (HttpOnly, SameSite, Secure flags) and CORS configuration. Tutorials commonly use `localStorage` to keep examples short.

**How to avoid:**
Store the access token in memory (React state/context) only. Store refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies. The access token dies when the tab closes; the cookie renews it silently. For this small-team app, session cookies or short-lived JWTs refreshed via cookie are both workable.

**Warning signs:**
- `localStorage.setItem('token', ...)` anywhere in auth code
- Access token outliving the browser session
- No `HttpOnly` flag on session/refresh cookies

**Phase to address:**
Auth implementation phase. Token storage strategy must be decided at the point of writing login — it is very hard to migrate later without breaking sessions.

---

### Pitfall 3: No Team Membership Authorization on Shared Task Endpoints

**What goes wrong:**
Shared team tasks are intended to be visible to all team members, but the API either (a) exposes them to any authenticated user regardless of team, or (b) relies on client-side filtering that can be bypassed. With no team scoping in database queries, authenticated users from different teams can read or mutate each other's tasks.

**Why it happens:**
The distinction between "authenticated" and "member of this team" is easy to conflate. With a small team and a single tenant in development, the bug is invisible — it only appears when a second team exists.

**How to avoid:**
Every shared task query must join against team membership. Schema: `teams`, `team_memberships(user_id, team_id)`, `tasks(team_id, ...)`. Query pattern: `SELECT t.* FROM tasks t JOIN team_memberships m ON t.team_id = m.team_id WHERE m.user_id = $1`. Never pass `team_id` from the client as an authorization parameter — derive it from the authenticated user's memberships server-side.

**Warning signs:**
- Routes like `GET /api/teams/:teamId/tasks` that don't validate the requester is a member of `teamId`
- `team_id` accepted from the request body without server-side membership verification
- A single user table with no team relationship model at all

**Phase to address:**
Data model design phase (before any team feature is implemented). The team membership relationship must be in the schema from the start — schema changes to add it retroactively require data migration.

---

### Pitfall 4: Database Schema Missing `created_at` / `updated_at` Timestamps

**What goes wrong:**
Tables are created without timestamp columns. Once data is live, it is impossible to sort tasks by creation time, debug ordering issues, build "recently completed" views, or audit changes. Adding timestamps after the fact requires a migration with `DEFAULT now()` that marks all existing rows with the migration timestamp — corrupting historical ordering.

**Why it happens:**
In a minimal CRUD app, timestamps feel optional. They add columns but provide no visible feature in the initial build.

**How to avoid:**
Add `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` to every table at creation time. Add a trigger or ORM hook to update `updated_at` on every write. Cost is near zero; value compounds over time.

**Warning signs:**
- `CREATE TABLE` statements without timestamp columns
- Relying on the auto-increment ID for ordering (works until it doesn't)
- Any request for "sort by newest" that cannot be satisfied without a migration

**Phase to address:**
Database design / initial schema phase. This is a zero-cost prevention that must happen before any data is inserted.

---

### Pitfall 5: CORS Configured as Wildcard (`*`) with Credentials in Production

**What goes wrong:**
`Access-Control-Allow-Origin: *` combined with `credentials: true` is rejected by all browsers — the two cannot coexist. Developers then either disable credentials (breaking cookie auth) or allowlist `*` differently in ways that enable reflection exploits where any origin can make credentialed requests to the API.

**Why it happens:**
CORS errors block local development immediately and visibly. The fastest fix — `origin: true` or `origin: '*'` — works in dev but creates production security holes or breaks when cookies are involved.

**How to avoid:**
Configure `@fastify/cors` with an explicit origin allowlist: `origin: ['http://localhost:5173', 'https://yourapp.com']` and `credentials: true`. Use environment variables to switch the origin list between dev and production. Never use `origin: '*'` with `credentials: true`.

**Warning signs:**
- CORS plugin registered with `origin: true` or `origin: '*'`
- Cookie auth working in dev but failing in staging/production
- No environment-variable-driven origin list

**Phase to address:**
API + frontend integration phase. Must be configured before any auth flow is tested end-to-end.

---

### Pitfall 6: Postgres Connection Leaks from Unreleased Pool Clients

**What goes wrong:**
When a database client is checked out from the pool and an error occurs before it is released, the connection is permanently removed from the pool. After enough leaks, the pool is exhausted and all subsequent requests hang indefinitely (or time out if `connectionTimeoutMillis` is not set).

**Why it happens:**
Developers release clients in the happy path but forget to release in error paths. Without `connectionTimeoutMillis` set, the failure is silent — requests just queue forever and look like a slow database rather than a code bug.

**How to avoid:**
Always release clients in a `finally` block. Prefer using `pool.query()` (auto-releases) over `pool.connect()` for simple queries. Set `connectionTimeoutMillis: 5000` so pool exhaustion fails fast. Use Fastify's `fastify-postgres` plugin which manages connection lifecycle through the plugin system.

**Warning signs:**
- `pool.connect()` calls without corresponding `.release()` in a `finally` block
- `connectionTimeoutMillis` not set (default: wait forever)
- Request latency climbing over time during load testing

**Phase to address:**
Database integration phase. Establish the query pattern (use pool.query or plugin-managed connections) before writing any route handlers.

---

### Pitfall 7: No Input Validation on API Endpoints

**What goes wrong:**
Without schema validation, malformed requests reach business logic and the database. This causes unexpected behavior, potential SQL injection (if queries are not parameterized), and confusing error messages. A recent Fastify vulnerability (CVE-2025-32442) showed that even content-type validation can be bypassed if Fastify is not kept current.

**Why it happens:**
Fastify's schema validation is opt-in per route. It is easy to build working routes without schemas, especially early in development when iteration speed is prioritized.

**How to avoid:**
Define JSON Schema for every route's `body`, `params`, and `querystring` from the first endpoint. Fastify uses AJV internally — schemas are compiled and fast. Use TypeScript with `fastify-type-provider-typebox` or `@fastify/type-provider-json-schema-to-ts` to get compile-time type safety from the same schemas. Keep Fastify updated (4.29.1+ or 5.3.2+ to patch CVE-2025-32442).

**Warning signs:**
- Routes defined without a `schema` property
- `req.body.title` used without validation that `title` exists and is a string
- No test sending malformed payloads and asserting 400 responses

**Phase to address:**
API design phase (before first route is shipped). Establish a schema-first pattern; retrofitting schemas is tedious.

---

### Pitfall 8: Virtual Keyboard Covers Input Fields on Mobile

**What goes wrong:**
On mobile browsers, the virtual keyboard opens when a text input is focused and reduces the visible viewport. If the input is positioned near the bottom of the screen (common for todo-entry forms), the keyboard covers it. The user cannot see what they are typing.

**Why it happens:**
This behavior differs between iOS Safari (resizes visual viewport only, not layout viewport) and Android Chrome (resizes both). CSS `100vh` does not account for the keyboard, so fixed-bottom layouts stay hidden behind it. Testing on desktop does not reveal the problem.

**How to avoid:**
Use dynamic viewport units: `height: 100dvh` instead of `100vh` for full-screen containers. Ensure todo-entry inputs scroll into view on focus with `scrollIntoView({ behavior: 'smooth' })`. Test on real mobile devices or browser DevTools with mobile simulation and virtual keyboard enabled. Avoid fixed-bottom positioning for primary input fields.

**Warning signs:**
- Using `100vh` for full-height layouts without `dvh` fallback
- A todo creation form pinned to the bottom of the screen
- No mobile device testing in the development workflow

**Phase to address:**
Frontend / UI phase. Must be caught during initial mobile layout work, not discovered after polish.

---

### Pitfall 9: Password Hashing with Insufficient Salt Rounds (or Not Hashed at All)

**What goes wrong:**
Passwords stored as plain text or with weak hashing (MD5, SHA-256 without salt, or bcrypt with cost factor < 10) are trivially cracked if the database is exposed. A bcrypt truncation bug in versions before 5.0.0 also caused long passwords to be hashed insecurely.

**Why it happens:**
Early development often stores passwords directly to get auth working quickly, with hashing "to be added later." The bcrypt version issue is not obvious without reading changelogs.

**How to avoid:**
Hash with `bcrypt` at cost factor 12 for production (10 is minimum acceptable). Use `bcrypt` npm package version 5.0.0 or higher. Never store plain text or reversibly encrypted passwords. Never log or return password fields anywhere.

**Warning signs:**
- Any `password` column in the database that is not consistently named `password_hash`
- `bcrypt` version below 5.0.0 in `package.json`
- Auth routes that return user objects without explicitly excluding the password field

**Phase to address:**
Auth implementation phase. Hashing strategy must be decided before user registration is built.

---

### Pitfall 10: Missing Refresh Token Strategy Causes Constant Logouts on Mobile

**What goes wrong:**
Short-lived JWTs (15–60 minutes) expire while a mobile user has the app open or returns after a brief break. The app shows an error or silently fails. Without a refresh token flow, users must log in repeatedly, which is a major friction point on mobile.

**Why it happens:**
Short expiry is correctly recommended as a security best practice. But without the corresponding refresh mechanism, the tradeoff is terrible UX. Many tutorials end at "token expires, log in again" without showing the refresh flow.

**How to avoid:**
Issue a short-lived access token (15–60 minutes, in memory) and a long-lived refresh token (7–30 days, in an HttpOnly cookie). On 401 responses, the client attempts a silent refresh. If refresh also fails, redirect to login. For this small-team app, a simple `POST /auth/refresh` endpoint that reads the cookie and issues a new access token is sufficient.

**Warning signs:**
- JWT `expiresIn` set to a short value with no refresh endpoint
- Auth context that does not handle 401 responses with a retry-after-refresh
- Users reporting "being logged out" as a bug during testing

**Phase to address:**
Auth implementation phase, after initial JWT login works. Build refresh before building protected routes that will time out.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store JWT in localStorage | Simple, works immediately | XSS exposes all tokens | Never — use HttpOnly cookie for refresh token |
| Skip ownership checks in early routes | Faster feature shipping | BOLA vulnerability in production | Never — scope queries from day one |
| No timestamps on tables | Simpler initial schema | Cannot sort by time, audit history, or add "recently done" views | Never — zero cost to add up front |
| Hardcode CORS origin | Dev setup faster | Broken in production or overly permissive | Only for the first 30 minutes of local dev, then fix |
| `pool.connect()` without `finally` release | Slightly less boilerplate | Pool exhaustion, silent request hang | Never — use pool.query() instead |
| Schema-less Fastify routes | Faster iteration | No validation, type-unsafe, security risk | Never in production routes; acceptable only for one-off debug endpoints |
| No refresh token flow | Simpler auth | Users constantly logged out on mobile | Acceptable in first prototype, must be addressed before real use |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@fastify/cors` | `origin: '*'` with `credentials: true` (browser rejects this) | Explicit origin array from environment variable |
| `fastify-postgres` / pg-pool | Calling `pool.connect()` then forgetting `.release()` in error path | Use `pool.query()` or Fastify's plugin request lifecycle which auto-releases |
| `fastify-jwt` | Not wrapping `request.jwtVerify()` in try/catch | Always catch — unhandled error crashes request handler |
| `bcrypt` | Using version below 5.0.0 (truncation bug) | Pin to `^5.0.0` or higher in package.json |
| React fetch + Fastify | Sending credentials with `fetch` but not setting `credentials: 'include'` | Always set `credentials: 'include'` when cookies are used |
| React fetch + Fastify | 401 responses not triggering token refresh before retrying | Implement response interceptor or query retry logic with refresh attempt |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `user_id` in `todos` table | Slow todo list queries as data grows | Add index at schema creation: `CREATE INDEX ON todos(user_id)` | Noticeable at ~10K todos |
| No index on `team_id` in shared tasks | Slow team task queries | Same as above: index `team_id` | Noticeable at ~5K shared tasks |
| Fetching all todos then filtering in JS | Memory spike, slow render on mobile | Always filter at the database level with WHERE clause | 100+ todos per user |
| Re-fetching full list after every mutation | Extra network round-trips on mobile (slow cell connections) | Use TanStack Query optimistic updates + targeted invalidation | Immediately noticeable on mobile |
| No connection pool limit set | Postgres connection limit hit under any real load | Set `max: 10` in pool config; size to Postgres `max_connections` limit | As low as 5 concurrent users without pooling |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| BOLA: fetching resources by ID without owner check | Any user reads/deletes any other user's todos | Scope all queries by authenticated user_id derived from JWT |
| No team membership check on shared task endpoints | Cross-team data exposure | Join against `team_memberships` in every shared task query |
| JWT in localStorage | Token stolen via XSS → account takeover | Access token in memory; refresh token in HttpOnly cookie |
| `Access-Control-Allow-Origin: *` with credentials | Any origin makes credentialed requests | Explicit origin allowlist in environment config |
| Password stored without bcrypt (or weak cost factor) | Database dump → cracked passwords in hours | bcrypt cost 12, version ≥5.0.0, never log password fields |
| JWT secret hardcoded or weak | Token forgery if secret is guessed or leaked | Strong random secret via environment variable; rotate if leaked |
| No rate limiting on auth endpoints | Brute-force credential attacks | Add `@fastify/rate-limit` to `/auth/login` and `/auth/register` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Virtual keyboard covers todo input on mobile | User cannot see what they are typing | Use `dvh` units; `scrollIntoView` on input focus |
| Tap targets smaller than 44x44px | Accidental taps, missed interactions on mobile | Minimum 44px touch target on all interactive elements; 8px+ spacing between them |
| Hover-only interactions (tooltips, delete buttons on hover) | Inaccessible on touch — no hover state on mobile | Use tap/long-press or always-visible controls for mobile |
| Form submits full page reload on mobile | Jarring flash, scroll position lost | React controlled forms with `event.preventDefault()` |
| No loading state on async todo operations | User taps repeatedly thinking action failed | Disable button + show spinner on submit; use optimistic updates for instant feedback |
| No offline/error feedback | Silent failure when network is flaky on mobile | Show clear error state; queue retries or at minimum show "failed, tap to retry" |
| Complex navigation for task switching | Friction switching between personal and team tasks | Tab bar or segmented control always visible; minimize navigation depth |

---

## "Looks Done But Isn't" Checklist

- [ ] **Auth:** Login works — but verify: does logout actually invalidate the session/cookie? Can a logged-out user still hit protected routes with an old token?
- [ ] **Personal todos:** CRUD works — but verify: run as User B and attempt to access User A's todo IDs directly. Should return 403/404.
- [ ] **Shared tasks:** Team tasks display — but verify: are they filtered to the authenticated user's team, or all teams in the database?
- [ ] **Mobile layout:** Looks fine at full height — but verify: open a text input, does the keyboard cover the input on iOS Safari and Android Chrome?
- [ ] **Delete todo:** Item disappears — but verify: does it respond immediately (optimistic) or wait for server? What happens if the server returns an error?
- [ ] **Timestamps:** Records created — but verify: is `created_at` set correctly? Is `updated_at` updating on mutations?
- [ ] **Schema validation:** Routes accept valid data — but verify: do routes reject extra fields? Reject missing required fields with a 400?
- [ ] **Database connections:** Works under normal use — but verify: run 20 concurrent requests; do connections return to the pool? Does pool exhaustion cause hangs?
- [ ] **Token expiry:** User can log in — but verify: wait for token to expire; does the app silently refresh or force re-login?

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| BOLA ownership checks missing | HIGH | Audit every endpoint; add ownership conditions to queries; write regression tests; potentially notify affected users if data was accessed |
| JWT in localStorage | MEDIUM | Migrate to HttpOnly cookie strategy; invalidate all existing tokens (force re-login); update client auth logic |
| Missing timestamps on live tables | MEDIUM | Migration adds columns with `DEFAULT now()` but existing rows get migration timestamp, not true creation time; ordering is corrupted for historical data |
| Pool connection leaks | MEDIUM | Identify leaking code paths; fix to use `finally` releases or `pool.query()`; restart server to restore pool; add `connectionTimeoutMillis` to fail fast |
| Hardcoded JWT secret in source | HIGH | Rotate secret immediately (invalidates all sessions); move to environment variable; audit git history; treat as compromised credential |
| No mobile keyboard handling | LOW | CSS change to `dvh` units + scroll-into-view call; testable immediately |
| Missing bcrypt (plain text passwords) | HIGH | Hash all existing passwords immediately; force all users to reset passwords; treat stored passwords as compromised |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| BOLA / Missing ownership checks | API + Auth setup (earliest routes) | Cross-user access test: User B cannot reach User A's resource IDs |
| JWT storage strategy | Auth implementation | No token in localStorage; HttpOnly cookie present on login response |
| Team membership authorization | Data model + team feature phase | Authenticated user from Team A cannot fetch Team B's shared tasks |
| Missing timestamps | Database schema design | `\d todos` shows `created_at` and `updated_at` columns with defaults |
| CORS misconfiguration | API + frontend integration | Production origin config uses env var; no wildcard with credentials |
| Connection pool leaks | Database integration setup | Load test 20 concurrent requests; pool metrics stable after completion |
| No input validation schemas | First API route | Sending invalid payloads returns 400; missing fields rejected |
| Mobile keyboard overlap | Frontend / mobile UI phase | Test on real device: focus an input; keyboard does not cover it |
| Weak password hashing | Auth implementation | `bcrypt` version ≥5.0.0; cost factor ≥12; no plain text storage |
| No refresh token flow | Auth — after initial login works | Access token expires; app refreshes silently without re-login prompt |

---

## Sources

- [Broken Object Level Authorization (BOLA) — OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [Fix IDOR Vulnerability in Node.js — cybersrely.com](https://www.cybersrely.com/fix-idor-vulnerability-in-node-js/)
- [JWT Storage in React: Local Storage vs Cookies Security Battle — cybersierra.co](https://cybersierra.co/blog/react-jwt-storage-guide/)
- [React security in 2025 — etixio.com](https://www.etixio.com/en/blog/security-react-2025/)
- [Fastify CVE-2025-32442: Improper Validation of Specified Type of Input — Snyk](https://security.snyk.io/vuln/SNYK-JS-FASTIFY-9788069)
- [Fastify Validation and Serialization — fastify.dev](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [Postgres RLS Implementation Guide: Best Practices and Common Pitfalls — permit.io](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Multi-Tenant Data Isolation with PostgreSQL Row Level Security — AWS Blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Node-Postgres Connection Pooling — node-postgres.com](https://node-postgres.com/features/pooling)
- [Node.js Connection Pooling in Production — DEV Community](https://dev.to/axiom_agent/nodejs-connection-pooling-in-production-postgresql-redis-and-http-4m76)
- [bcrypt npm package — vulnerability notes for v5.0.0](https://www.npmjs.com/package/bcrypt)
- [Bcrypt truncation bug — PortSwigger Daily Swig](https://portswigger.net/daily-swig/bcrypt-hashing-library-bug-leaves-node-js-applications-open-to-brute-force-attacks)
- [Fastify + Vite CORS in production vs local — Medium](https://medium.com/@bbangjoa/when-fetch-works-locally-but-fails-on-production-a-cors-tale-from-vite-fastify-8a50302c9db7)
- [Fix mobile keyboard overlap with VisualViewport — DEV Community](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a)
- [Improving Tap Targets for Better Mobile UX — OpenReplay Blog](https://blog.openreplay.com/improving-tap-targets-mobile-ux/)
- [Concurrent Optimistic Updates in React Query — tkdodo.eu](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Soft Deletion with PostgreSQL — Evil Martians](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database)

---
*Pitfalls research for: mobile-first React + Fastify + Postgres team todo app*
*Researched: 2026-04-05*
