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

```bash
yarn install
```


### Run

```bash
# Development (ts-node)
yarn dev

# Production (compiled)
yarn build
yarn start
```

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


