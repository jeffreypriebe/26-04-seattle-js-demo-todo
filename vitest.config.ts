import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      exclude: ['src/db/schema.ts', 'src/db/migrate.ts'],
    },
  },
})
