# Feature Research

**Domain:** Mobile-first todo/task management app — personal + shared team task pools
**Researched:** 2026-04-05
**Confidence:** MEDIUM (competitor analysis from public docs and reviews; no user interviews)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create / edit / delete tasks | Core CRUD — the entire product purpose | LOW | Inline editing on mobile preferred over separate form screens |
| Mark task complete (toggle) | Satisfying completion loop — users expect instant feedback | LOW | Optimistic UI update; undo affordance reduces anxiety |
| Personal task list per user | Every todo app since 2005 has private lists | LOW | Scope by user_id at the API layer — not a shared view |
| Shared team task pool | The collaboration reason to choose a team app over Notes.app | MEDIUM | Visibility scoped to team/workspace; accessible to all members |
| User authentication (sign up / log in / log out) | Required for any per-user or per-team data boundary | MEDIUM | Email + password sufficient for v1; social auth is nice-to-have |
| Persistent data across sessions | Users expect tasks to survive closing the browser tab | LOW | Postgres-backed API; no local-only storage |
| Mobile-first responsive layout | Users open this on their phone | MEDIUM | Bottom navigation, thumb-zone targets (44x44px min), no hover-dependent interactions |
| Task ordering / sorting | Users need to prioritize within a list | LOW | Manual reorder (drag or up/down) OR sort by created_at — pick one for v1 |
| Empty state guidance | First-time users need a hint on what to do | LOW | Placeholder text + a sample task or "Add your first task" CTA |
| Visual distinction between personal and shared tasks | Two pools in one app — users must know which is which | LOW | Tab or section header is sufficient; color accent helps |

### Differentiators (Competitive Advantage)

Features that make the product worth using over a shared Notes doc or generic app.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Optimistic UI / instant feedback | Mobile apps feel slow when every tap waits for a round-trip — snappiness is a differentiator on mobile web | MEDIUM | Mutate local state first, sync to API, rollback on error; requires error handling care |
| Swipe-to-complete / swipe-to-delete gestures | Power users on mobile expect touch shortcuts; reduces tap depth by 1 step | MEDIUM | Web-based swipe requires careful implementation (touch events + CSS translate); consider as v1.x |
| Clear task ownership signal on shared pool | When multiple people use a shared list, knowing who added what reduces confusion | LOW | Show creator name/avatar on shared tasks; no assignment needed (that's v2) |
| Completion count / activity feedback | Light gamification ("You completed 5 tasks today") creates positive reinforcement | LOW | Simple counter from DB query; no complex karma system needed |
| Fast task entry (minimal taps to add) | The #1 friction point in todo apps is the add flow; fewer taps = more tasks captured | LOW | Floating action button or persistent input bar at bottom; submit on Enter |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good on paper but should be explicitly excluded from v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time live updates (WebSockets) | Teams want to see changes without refreshing | Adds significant infrastructure complexity (socket server, connection management, reconnect logic); not required when team is small | Pull-to-refresh or polling on tab focus; acceptable for v1 team size |
| Task assignment on shared tasks | "Who is doing this?" is a natural team question | Requires user directory, assignment UX, notification system, and ownership semantics — 3x the scope | Show creator; assignment is explicit v2 scope |
| Due dates and reminders | Every todo app has them; users will ask | Reminders require push notifications (service workers, permissions) or email infrastructure; due dates require date picker UI and sorting logic | Accept as v1.x once core CRUD is stable; due date display without notifications is feasible in v1 |
| Priority levels (P1-P4) | Power users want urgency signaling | Adds sorting/filtering complexity and visual noise before the app has traction | Manual reorder covers priority for a small team |
| Sub-tasks / task hierarchy | Breaking tasks down feels productive | Recursive data model and nested UX on mobile are complex; most users never use them | Task descriptions (free text) cover breakdowns without nesting |
| Labels / tags / filters | Cross-project organization for power users | Requires tag taxonomy, filter UI, and indexed queries — high complexity for v1 value | Sections or list grouping is sufficient at small team scale |
| Third-party integrations (Slack, email, calendar) | "Pipe everything into one place" is appealing | Each integration is a mini-project; auth flows, webhooks, and error handling multiply scope | Not for v1; explicitly out of scope per PROJECT.md |
| Native mobile app (iOS/Android) | Better gestures, push notifications, offline | React Native or Flutter is a separate codebase; mobile web is sufficient for the learning goal | Mobile web with responsive layout; PROJECT.md explicitly scopes to web |
| AI-assisted task suggestions | Trendy in 2025-2026 task tools | Requires LLM integration, latency management, and adds no value until there's enough task history | Not for v1 |

---

## Feature Dependencies

```
[User Authentication]
    └──requires──> [Personal Task List]
    └──requires──> [Shared Task Pool]
                       └──requires──> [Team / Workspace concept]

[Task CRUD]
    └──requires──> [User Authentication]

[Shared task creator signal]
    └──requires──> [Task CRUD]
    └──requires──> [User Authentication] (to know who created it)

[Swipe gestures]
    └──enhances──> [Task CRUD] (complete / delete shortcuts)
    └──requires──> [Task CRUD] (the actions must exist first)

[Completion count / activity feedback]
    └──requires──> [Task CRUD] (needs completed state)

[Due dates]
    └──enhances──> [Task CRUD]
    └──conflicts──> [Reminders] (reminders require notification infrastructure beyond date storage)

[Task assignment]
    └──requires──> [User Authentication]
    └──requires──> [Shared Task Pool]
    └──conflicts──> [v1 scope] (explicitly deferred)
```

### Dependency Notes

- **Authentication gates everything:** Personal and shared task isolation is only meaningful once users have identities. Auth must be phase 1.
- **Shared pool requires workspace concept:** Even a simple "team" means multiple users need to see the same data. The data model must represent a team/workspace entity, not just individual user rows.
- **Swipe gestures enhance but don't require special backend:** The actions (complete/delete) can exist as button taps first; gestures layer on top without new API surface.
- **Due dates and reminders are separate concerns:** Storing a due_date column is low complexity; triggering notifications is high complexity. These should not be bundled.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what validates the core value proposition: "personal + shared tasks, reliably persisted, accessible on mobile."

- [ ] User sign up, log in, log out — identity boundary required for all scope
- [ ] Personal task list: create, complete, delete tasks — core product loop
- [ ] Shared team task pool: create, complete, delete tasks visible to all team members — the collaboration differentiator
- [ ] Task text and completion state only — no dates, no priorities, no labels in v1
- [ ] Mobile-first responsive UI with bottom navigation and thumb-friendly touch targets
- [ ] Creator name shown on shared tasks — minimal ownership signal without full assignment
- [ ] Empty states for both personal and shared lists

### Add After Validation (v1.x)

Features to add once the core CRUD loop is working and users are returning.

- [ ] Due dates (date storage + display, no notifications) — trigger: users ask "when is this due?"
- [ ] Swipe-to-complete and swipe-to-delete gestures — trigger: mobile usage confirmed, UX polish sprint
- [ ] Pull-to-refresh on shared task pool — trigger: team coordination friction reported
- [ ] Completion counter / activity feedback — trigger: engagement metric dips after initial signup

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Task assignment on shared tasks — requires user directory and notification system
- [ ] Due date reminders / push notifications — requires service worker + permissions flow
- [ ] Sub-tasks — requires recursive data model and nested mobile UX
- [ ] Priority levels + sorting — requires filter UI investment
- [ ] Third-party integrations — explicitly out of scope per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| User authentication | HIGH | MEDIUM | P1 |
| Personal task CRUD | HIGH | LOW | P1 |
| Shared team task CRUD | HIGH | MEDIUM | P1 |
| Mobile-first responsive layout | HIGH | MEDIUM | P1 |
| Creator name on shared tasks | MEDIUM | LOW | P1 |
| Empty states | MEDIUM | LOW | P1 |
| Task ordering (manual or created_at) | MEDIUM | LOW | P1 |
| Due date storage + display | MEDIUM | LOW | P2 |
| Swipe gestures | MEDIUM | MEDIUM | P2 |
| Pull-to-refresh | LOW | LOW | P2 |
| Completion counter | LOW | LOW | P2 |
| Task assignment | HIGH | HIGH | P3 |
| Push notification reminders | MEDIUM | HIGH | P3 |
| Sub-tasks | LOW | HIGH | P3 |
| Priority labels + filtering | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Todoist | Things 3 | Linear | Our Approach |
|---------|---------|----------|--------|--------------|
| Personal task list | Yes — Inbox + Projects | Yes — primary model | Partial (My Issues) | Yes — first-class personal list |
| Shared/team tasks | Yes — Shared Projects + Workspaces | No — individual only | Yes — primary model | Yes — first-class shared pool |
| Due dates | Yes — NLP date entry | Yes — NLP date entry | Yes — but hidden in submenus | v1.x — date storage without NLP |
| Priority levels | Yes — P1–P4 | Yes — stars | Yes — Urgent/High/Medium/Low | Deferred — manual order covers v1 |
| Mobile app | Native iOS/Android | Native iOS only | Native iOS/Android | Mobile web — no native app |
| Swipe gestures | Yes — native app | Yes — native app | No | v1.x — native gestures via touch events |
| Task assignment | Yes | No | Yes — primary feature | Deferred to v2 |
| Integrations | 80+ | Apple ecosystem | GitHub, Slack, Figma | None for v1 |
| Workspace separation | Yes — Workspaces | No (personal only) | Yes — Teams | Yes — team boundary in data model |

**Key insight:** Neither Things 3 (individual-only) nor Linear (engineering workflow) covers the personal + shared team task use case with a lightweight, mobile-first approach. Todoist does, but its mobile web experience lags its native apps. This app's v1 is more focused than Todoist and more collaborative than Things 3.

---

## Sources

- [Todoist Features](https://www.todoist.com/features) — official feature list
- [Efficient App: Todoist vs Linear](https://efficient.app/compare/todoist-vs-linear) — comparison analysis
- [Upbase: Todoist vs Things 3 (2025)](https://upbase.io/blog/todoist-vs-things-3/) — feature-by-feature comparison
- [LogRocket: Swipe-to-delete and swipe-to-reveal interactions](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/) — mobile gesture UX patterns
- [Elaris: Mobile UX Thumb Zones 2025](https://elaris.software/blog/mobile-ux-thumb-zones-2025/) — touch target sizing standards
- [Getduodo: Top Shared Task List Apps 2025](https://www.getduodo.com/getduodo/blog/top-10-shared-task-list-apps-for-2025) — shared task list feature analysis
- [TechRadar: Best Task Management Apps 2026](https://www.techradar.com/best/best-task-management-apps-of-year) — current market landscape
- [Zapier: Best To-Do List Apps 2026](https://zapier.com/blog/best-todo-list-apps/) — review aggregation

---
*Feature research for: Mobile-first todo/task management app — personal + shared team task pools*
*Researched: 2026-04-05*
