# Stack Research

**Domain:** Mobile-first React + Fastify + Postgres todo/task management app
**Researched:** 2026-04-05
**Confidence:** HIGH (all versions verified against npm registry; library choices verified via multiple current sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.4 | UI framework | Current stable; Actions API simplifies form/mutation patterns without extra libraries |
| TypeScript | 6.0.2 | Type safety across front and back | Single language across the stack; TypeScript 6 brings significant inference improvements |
| Vite | 8.0.x | Frontend build tool | 40x faster than CRA; native ESM; de facto standard for non-Next.js React in 2026 |
| Fastify | 5.8.4 | HTTP API framework | Schema-first, 2x faster than Express, native TypeScript support, official plugin ecosystem |
| Postgres (postgres.js) | 3.4.9 | Postgres driver | Fastest pure-JS Postgres driver; Drizzle recommends it; no native compilation required |
| Drizzle ORM | 0.45.2 | Database ORM/query builder | TypeScript-native schema-as-code; SQL-like API; no code generation step; 5KB bundle; passes Prisma in downloads late 2025 |
| drizzle-kit | 0.31.10 | Drizzle migration CLI | Paired with drizzle-orm; interactive rename detection; generates SQL migrations |

### UI Layer

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Tailwind CSS | 4.2.2 | Utility-first styling | CSS-first config in v4 (no tailwind.config.js); OKLCH colors; industry default for shadcn/ui |
| shadcn/ui | latest (CLI-managed) | Component library | Copy-into-your-codebase model; 75K+ GitHub stars; full Tailwind v4 + React 19 support as of 2026; accessible by default via Radix primitives |
| Radix UI primitives | bundled via shadcn | Accessible UI primitives | Still the default primitive layer for shadcn/ui; Base UI is an emerging alternative but shadcn/ui supports both |
| lucide-react | 1.7.0 | Icon library | Official icon set recommended by shadcn/ui; tree-shakeable |
| class-variance-authority | 0.7.1 | Variant styling | Required by shadcn/ui component patterns |
| clsx | 2.1.1 | Conditional class merging | Lightweight; used with tailwind-merge |
| tailwind-merge | 3.5.0 | Tailwind class conflict resolution | Prevents Tailwind utility class conflicts in components |

### Data Fetching & State

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| TanStack Query | 5.96.2 | Server state management | 12M weekly downloads; best-in-class caching, mutation lifecycle, devtools; better than SWR for mutation-heavy apps like todo lists |
| React Hook Form | 7.72.1 | Form state management | Uncontrolled inputs; minimal re-renders; integrates natively with Zod via `@hookform/resolvers` |
| React Router | 7.14.0 | Client-side routing | v7 stabilized in 2025; framework mode or library mode; standard for Vite/React SPAs |

### Validation & Auth

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Zod | 4.3.6 | Schema validation | Shared between frontend (form validation) and backend (request validation); single source of truth for data shapes |
| fastify-type-provider-zod | 6.1.0 | Fastify + Zod integration | Wires Zod schemas into Fastify's validator/serializer; provides end-to-end type inference on routes |
| @fastify/jwt | 10.0.0 | JWT auth plugin | Official Fastify plugin; uses fast-jwt internally; decorates request with `jwtVerify`, reply with `jwtSign` |
| bcryptjs | 3.0.3 | Password hashing | Pure JS bcrypt; no native compilation; appropriate for server-side password storage |

### Fastify Plugins

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @fastify/cors | 11.2.0 | CORS headers | Required for browser-to-API communication during development |
| @fastify/swagger | 9.7.0 | OpenAPI spec generation | Useful for API documentation during development; optional for v1 |
| @fastify/swagger-ui | 5.2.5 | Swagger UI | Visual API explorer; pairs with @fastify/swagger |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit/integration testing | Native Vite integration; Jest-compatible API |
| ESLint | Linting | TypeScript-aware; use `@typescript-eslint` preset |
| Prettier | Code formatting | Opinionated formatter; reduces review friction |
| Docker Compose | Local Postgres | Spin up Postgres locally without installing natively |
| dotenv / @fastify/env | Environment config | @fastify/env validates env vars against a schema at startup |

---

## Installation

```bash
# Frontend (in /client or root)
npm create vite@latest client -- --template react-ts
cd client
npm install react-router-dom @tanstack/react-query react-hook-form @hookform/resolvers zod
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init  # installs lucide-react, clsx, tailwind-merge, class-variance-authority

# Backend (in /server or /api)
mkdir server && cd server && npm init -y
npm install fastify @fastify/jwt @fastify/cors fastify-type-provider-zod zod postgres drizzle-orm bcryptjs
npm install -D typescript drizzle-kit @types/node @types/bcryptjs tsx

# Dev tooling (both)
npm install -D vitest eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| ORM | Drizzle ORM | Prisma | Prisma wins when team prefers generated client API, schema-first workflow, or is deploying to Vercel Node.js functions and wants fastest initial velocity |
| UI components | shadcn/ui | MUI (Material UI) | MUI when you need a complete pre-designed system with Material Design guidelines and no desire to customize component internals |
| Auth | @fastify/jwt (custom) | Better Auth | Better Auth when you need OAuth providers (Google, GitHub login) out of the box; overkill for username/password only |
| Data fetching | TanStack Query | SWR | SWR when bundle size is the primary concern (4KB vs 13KB) and mutations are simple; TanStack Query wins for todo app mutation patterns |
| Routing | React Router v7 | TanStack Router | TanStack Router when you need fully type-safe URL params and search params in a complex SPA |
| Postgres driver | postgres.js | pg (node-postgres) | pg when you need per-query type parsers or are integrating with existing pg-based infrastructure |
| Build tool | Vite | Next.js | Next.js when you need SSR, SSG, or tight Vercel deployment integration; overkill for this project |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App | Abandoned/unmaintained since 2023; extremely slow builds | Vite |
| TypeORM | Decorator-based API; poor TypeScript inference; considered legacy in 2025 | Drizzle ORM |
| Sequelize | JavaScript-first ORM; TypeScript support bolted on; poor type inference | Drizzle ORM |
| Passport.js | Designed for Express; awkward adapter layer required for Fastify; adds complexity | @fastify/jwt + bcryptjs directly |
| Redux / Redux Toolkit | Overkill for a todo app with REST API; TanStack Query handles server state; no complex client state needed | TanStack Query + React Hook Form |
| axios | No longer needed; TanStack Query wraps `fetch` natively; axios adds a dependency for no gain | Native fetch via TanStack Query |
| jsonwebtoken | @fastify/jwt uses fast-jwt internally which is faster; no reason to use directly | @fastify/jwt |
| next-auth / Auth.js | Next.js-first library; adapter support for Fastify is fragile and undocumented | @fastify/jwt + bcryptjs |
| Styled Components / Emotion | CSS-in-JS has runtime cost and poor mobile performance; Tailwind compiles to zero-runtime CSS | Tailwind CSS |

---

## Stack Patterns by Variant

**If deploying to a PaaS (Railway, Render, Fly.io):**
- Use `postgres.js` driver directly (no connection pooling middleware needed for small teams)
- Set `DATABASE_URL` env var; Drizzle reads it via `postgres(process.env.DATABASE_URL)`

**If the team grows and OAuth becomes needed:**
- Add Better Auth on top of the existing Fastify app — it supports Fastify as a first-class adapter
- No rewrite required; JWT sessions can coexist

**If offline support becomes a requirement (post-v1):**
- TanStack Query's `persistQueryClient` plugin + IndexedDB for caching
- Service worker via `vite-plugin-pwa` for offline asset serving

**If swipe-to-complete gestures are desired on mobile:**
- Add `react-swipeable` (lightweight, no dependencies) for swipe gesture detection on todo rows
- Avoid `@use-gesture/react` (heavier, designed for complex animations)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| shadcn/ui (CLI-managed) | Tailwind CSS 4.x, React 19.x | shadcn/ui CLI handles component compatibility; do NOT mix Tailwind v3 components with v4 setup |
| fastify-type-provider-zod 6.x | Fastify 5.x, Zod 4.x | v6 is required for Fastify v5; v5.x is for Fastify v4 |
| @fastify/jwt 10.x | Fastify 5.x | Major version tracks Fastify major version |
| @fastify/cors 11.x | Fastify 5.x | Same pattern — plugin major version tracks Fastify |
| Drizzle ORM 0.45.x | postgres.js 3.x, TypeScript 5.x+ | Works with TS 6 as well; drizzle-kit must match drizzle-orm minor version |
| TanStack Query 5.x | React 18.x, React 19.x | v5 dropped React 17 support; React 19 is fully supported |
| React Hook Form 7.x | React 18.x, React 19.x | Compatible with React 19 concurrent features |

---

## Mobile-First Considerations

This project targets **mobile web browsers** as primary. Key implications for the stack:

- **shadcn/ui** components are touch-friendly by default (44px tap targets via Radix primitives)
- **Tailwind CSS v4** mobile-first breakpoint system: write base styles for mobile, use `md:` and `lg:` for larger screens
- **No heavy animation libraries** — CSS transitions via Tailwind are sufficient; avoid Framer Motion unless gestures are added
- **TanStack Query** optimistic updates keep the UI responsive on slow mobile connections — use `onMutate` to update the todo list before the server confirms
- **React Hook Form** minimizes re-renders which matters on lower-end Android devices
- **Vite** produces optimal chunk splitting for fast initial mobile loads

---

## Sources

- npm registry (direct fetch, 2026-04-05) — all version numbers verified
- [Drizzle vs Prisma 2026 - makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — ORM comparison (MEDIUM confidence; multiple sources corroborate)
- [Drizzle ORM PostgreSQL docs](https://orm.drizzle.team/docs/get-started-postgresql) — official driver recommendations (HIGH confidence)
- [shadcn/ui Tailwind v4 migration guide](https://ui.shadcn.com/docs/tailwind-v4) — official docs (HIGH confidence)
- [fastify/fastify-jwt GitHub](https://github.com/fastify/fastify-jwt) — official plugin (HIGH confidence)
- [fastify-type-provider-zod GitHub](https://github.com/turkerdev/fastify-type-provider-zod) — Fastify v5 + Zod v4 integration (MEDIUM confidence; widely referenced in community)
- [TanStack Query vs SWR 2025 - refine.dev](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/) — data fetching comparison (MEDIUM confidence)
- [shadcn/ui vs Base UI vs Radix 2026 - pkgpulse.com](https://www.pkgpulse.com/blog/shadcn-ui-vs-base-ui-vs-radix-components-2026) — UI library landscape (MEDIUM confidence)
- [Node.js ORMs 2025 - thedataguy.pro](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/) — ORM ecosystem overview (MEDIUM confidence)

---

*Stack research for: Mobile-first React + Fastify + Postgres todo app*
*Researched: 2026-04-05*
