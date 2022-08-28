import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{test,bench}/**/*.test.ts'],
    globals: true,
  },
})
