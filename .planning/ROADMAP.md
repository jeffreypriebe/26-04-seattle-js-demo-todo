# Roadmap: Team Todo App

## Overview

Build a mobile-first team todo application from the ground up: database schema first, then authentication, then personal task CRUD, then the React frontend shell, then personal task UI, then team management, and finally shared team tasks. Each phase delivers a coherent vertical slice — backend and data layers first to establish patterns, then UI layers to make features user-visible. The project finishes with every user-facing feature working end-to-end on mobile.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Database Foundation** - SQLite schema, Drizzle ORM, and local dev environment
- [ ] **Phase 2: Authentication** - Secure signup, login, logout, and password reset
- [ ] **Phase 3: Personal Tasks API** - Full personal task CRUD endpoints with ownership enforcement
- [ ] **Phase 4: React App Shell + Auth UI** - Mobile layout shell, bottom nav, and auth screens
- [ ] **Phase 5: Personal Tasks UI** - Complete personal task list feature end-to-end
- [ ] **Phase 6: Team Management** - Team creation, invite links, and join flow
- [ ] **Phase 7: Team Tasks** - Shared team task pool visible and manageable by all members

## Phase Details

### Phase 1: Database Foundation
**Goal**: The data layer is ready — all tables exist, migrations run cleanly, and the SQLite database is set up for local dev
**Depends on**: Nothing (first phase)
**Requirements**: (none — infrastructure phase enabling all subsequent phases)
**Success Criteria** (what must be TRUE):
  1. SQLite database file is created automatically on first run — no separate server or Docker required
  2. Running the migration command applies all 5 tables (users, teams, team_members, todos, team_tasks) with no errors
  3. The schema has separate `todos` and `team_tasks` tables — not a nullable team_id column on a single table
  4. Every table has `created_at` and `updated_at` timestamps and indexed foreign keys
**Plans**: TBD

### Phase 2: Authentication
**Goal**: Users can securely create accounts, log in, stay logged in across sessions, and recover lost passwords
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password and receives a valid session
  2. User can log in and remain authenticated across browser sessions (refresh token survives page reload)
  3. User can log out from any page and is immediately denied access to protected resources
  4. User can request a password reset email and set a new password via the link
  5. Access token is never stored in localStorage — only in memory; refresh token is in an HttpOnly cookie
**Plans**: TBD

### Phase 3: Personal Tasks API
**Goal**: All personal task CRUD endpoints exist, are secured to the authenticated user, and reject any attempt to access another user's tasks
**Depends on**: Phase 2
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08
**Success Criteria** (what must be TRUE):
  1. Authenticated user can create, read, update, and delete their own personal tasks via the API
  2. Tasks with a due date are returned in due-date order; tasks without dates appear last
  3. A request to access or modify another user's task returns 403 — not the task data
  4. All route requests and responses are validated against Zod schemas (no schema-less routes)
  5. Task list endpoint supports filtering to return only tasks that have a due date set
**Plans**: TBD

### Phase 4: React App Shell + Auth UI
**Goal**: The app opens on mobile with a working layout — bottom navigation, correct keyboard handling, and auth screens that let users sign up and log in
**Depends on**: Phase 2
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. App displays a bottom navigation bar that switches between Personal and Team views with a single tap
  2. User can sign up and log in through the app UI — not just via API calls
  3. All interactive elements (buttons, nav items, form controls) have at least a 44px touch target
  4. The layout does not break when the mobile virtual keyboard appears — input fields remain visible and usable
**Plans**: TBD
**UI hint**: yes

### Phase 5: Personal Tasks UI
**Goal**: A user can fully manage their personal task list from a phone — create tasks, set due dates, reorder, filter, complete, and delete — with instant feedback
**Depends on**: Phase 3, Phase 4
**Requirements**: (none — TASK requirements covered in Phase 3; this phase delivers the user-facing view of that API)
**Success Criteria** (what must be TRUE):
  1. User can add a task with minimal taps using the floating action button or persistent bottom input
  2. User can mark a task complete and unmark it — the toggle is visible and immediate
  3. User can delete a personal task from the list
  4. Task list defaults to due-date order with undated tasks at the bottom; user can manually reorder tasks within that view
  5. User can filter the list to show only tasks with a due date; an empty state with guidance appears when no tasks exist
**Plans**: TBD
**UI hint**: yes

### Phase 6: Team Management
**Goal**: Users can create a team, invite others via a shareable link or code, and join an existing team — all team membership is enforced server-side
**Depends on**: Phase 4
**Requirements**: TEAM-01, TEAM-02, TEAM-03
**Success Criteria** (what must be TRUE):
  1. User can create a team and becomes its first member
  2. User can generate and share an invite link or code that another person can use to join
  3. User can join an existing team by entering an invite code or following an invite link
  4. Membership is validated server-side — a non-member cannot access a team's tasks
**Plans**: TBD
**UI hint**: yes

### Phase 7: Team Tasks
**Goal**: All team members can view and manage the shared task pool — every CRUD action is visible to all members, and each task shows who created it
**Depends on**: Phase 5, Phase 6
**Requirements**: TEAM-04, TEAM-05, TEAM-06, TEAM-07, TEAM-08, TEAM-09
**Success Criteria** (what must be TRUE):
  1. All team members see the same shared task pool when they open the Team view
  2. Any team member can create a task in the shared pool; the creator's name appears on the task
  3. Any team member can mark any shared task complete (toggle) or delete it
  4. A non-member cannot read or modify the team's tasks — the API returns 403
  5. An empty state with guidance appears in the Team view when no shared tasks exist
**Plans**: TBD
**UI hint**: yes

## Future Roadmap (Post-v1)

Features deferred until the core v1 is shipped and validated.

### Live Updates (v2)

Replace the current load-on-navigate model with real-time sync so team members see changes without refreshing.

**Options to evaluate at that point:**
- **Polling on tab focus** — simplest; re-fetch shared tasks when user returns to the app (no infrastructure changes)
- **Short-interval polling** — fetch every 15–30s; acceptable latency for small teams, no WebSocket complexity
- **WebSockets via `@fastify/websocket`** — true real-time; requires connection management, reconnect logic, and server-side broadcast; justified once team coordination friction is confirmed

**Trigger:** Ship v1, observe whether team members complain about stale data. Start with focus-polling before committing to WebSockets.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Foundation | 0/? | Not started | - |
| 2. Authentication | 0/? | Not started | - |
| 3. Personal Tasks API | 0/? | Not started | - |
| 4. React App Shell + Auth UI | 0/? | Not started | - |
| 5. Personal Tasks UI | 0/? | Not started | - |
| 6. Team Management | 0/? | Not started | - |
| 7. Team Tasks | 0/? | Not started | - |
