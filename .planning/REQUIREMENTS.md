# Requirements: Team Todo App

**Defined:** 2026-04-05
**Core Value:** Every task gets saved and stays in sync — personal todos and shared team tasks reliably persisted and accessible on mobile.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in with email and password and stay logged in across browser sessions
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User can reset password via email link

### Personal Tasks

- [ ] **TASK-01**: User can create a personal task with a title
- [ ] **TASK-02**: User can optionally set a due date on a personal task
- [ ] **TASK-03**: User can mark a personal task as complete (toggle)
- [ ] **TASK-04**: User can delete a personal task
- [ ] **TASK-05**: Personal task list defaults to due-date order (tasks without dates appear last)
- [ ] **TASK-06**: User can manually reorder personal tasks within the due-date view
- [ ] **TASK-07**: User can filter personal tasks to show only tasks with a due date
- [ ] **TASK-08**: Personal task list shows an empty state with guidance when no tasks exist

### Shared Team Tasks

- [ ] **TEAM-01**: User can create a team and become its first member
- [ ] **TEAM-02**: User can invite others to a team via a shareable link or code
- [ ] **TEAM-03**: User can join an existing team via invite link or code
- [ ] **TEAM-04**: All team members can view the shared team task pool
- [ ] **TEAM-05**: All team members can create tasks in the shared pool
- [ ] **TEAM-06**: All team members can mark any shared task as complete (toggle)
- [ ] **TEAM-07**: All team members can delete any shared task
- [ ] **TEAM-08**: Each shared task displays the name of the user who created it
- [ ] **TEAM-09**: Shared team task list shows an empty state with guidance when no tasks exist

### Mobile UX

- [ ] **UX-01**: App uses a bottom navigation bar to switch between Personal and Team views
- [ ] **UX-02**: User can add a task with minimal taps (floating action button or persistent bottom input)
- [ ] **UX-03**: All interactive elements meet a 44px minimum touch target size
- [ ] **UX-04**: Layout does not break when mobile virtual keyboard appears (uses dvh units)

## v2 Requirements

### Task Enhancements

- **TASK-V2-01**: User can swipe to complete or delete a task (gesture shortcut)
- **TASK-V2-02**: Pull-to-refresh on the shared task pool
- **TASK-V2-03**: Completion count / daily activity feedback
- **TASK-V2-04**: Task edit (modify title or due date after creation)

### Team Enhancements

- **TEAM-V2-01**: Task assignment — assign a shared task to a specific team member
- **TEAM-V2-02**: Multiple teams — user can be a member of more than one team

### Notifications

- **NOTF-V2-01**: Due date reminders via push notification or email

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time live updates (WebSockets) | Infrastructure complexity not justified for small-team v1; pull-to-refresh is sufficient |
| Native mobile app (iOS/Android) | Mobile web is the target; native is a separate codebase |
| Third-party integrations (Slack, email, calendar) | Multiplies scope; not core to v1 value |
| Priority levels (P1–P4) | Manual reorder and due dates cover prioritization for v1 |
| Sub-tasks / task hierarchy | Recursive data model + nested mobile UX is high complexity for low v1 value |
| Labels / tags / filtering | Task volume at small-team scale doesn't require taxonomy |
| AI-assisted task suggestions | No task history to leverage; adds latency and cost |
| OAuth / social login | Email + password is sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| TASK-01 | Phase 3 | Pending |
| TASK-02 | Phase 3 | Pending |
| TASK-03 | Phase 3 | Pending |
| TASK-04 | Phase 3 | Pending |
| TASK-05 | Phase 3 | Pending |
| TASK-06 | Phase 3 | Pending |
| TASK-07 | Phase 3 | Pending |
| TASK-08 | Phase 3 | Pending |
| TEAM-01 | Phase 6 | Pending |
| TEAM-02 | Phase 6 | Pending |
| TEAM-03 | Phase 6 | Pending |
| TEAM-04 | Phase 7 | Pending |
| TEAM-05 | Phase 7 | Pending |
| TEAM-06 | Phase 7 | Pending |
| TEAM-07 | Phase 7 | Pending |
| TEAM-08 | Phase 7 | Pending |
| TEAM-09 | Phase 7 | Pending |
| UX-01 | Phase 4 | Pending |
| UX-02 | Phase 4 | Pending |
| UX-03 | Phase 4 | Pending |
| UX-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after roadmap creation (traceability mapped)*
