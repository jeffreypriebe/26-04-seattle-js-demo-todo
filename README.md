# Team Todo App

## What This Is

A mobile-first todo tracking application for small teams. Users can manage their own personal task lists and collaborate on shared team tasks. Built with a React frontend, Node/Fastify API, and SQLite database for persistence.

## Planning documents

Review MD files in .planning directory for the project overview and requirements.

## Setup

### Prerequisites

- Node.js 24+
- Yarn

### Install

API (root):

```bash
yarn install
```

React client:

```bash
cd client && npm install
```

### Environment

Copy the example env file before starting the API:

```bash
cp .env.example .env
```

`JWT_SECRET` has a safe default for local dev — you can leave it as-is unless you need to test production auth behavior.

### Run

**API server** (Fastify, port 3001):

```bash
yarn dev
```

**React client** (Vite dev server, port 5173):

```bash
cd client
npm run dev
```

Open http://localhost:5173 in your browser. The Vite dev server proxies `/auth` and `/tasks` to the API automatically — start both servers for full functionality.

## Testing

Tests use [Vitest](https://vitest.dev/). All test files live under `src/` and match the pattern `**/*.test.ts`.

### Run tests

```bash
yarn test
```

### Requirements

- Node.js 24+ and Yarn must be installed
- Run `yarn install` before running tests
- Tests must pass before any merge — the refinery runs `yarn test` as part of validation

### Test structure

Tests live alongside the code they test in `src/`. Integration tests that require a database use an in-memory SQLite instance — no external services needed. A `.env.test` file is not required unless you add environment-dependent configuration.


