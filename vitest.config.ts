import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      tinypool: resolve(__dirname, './dist/index.js'),
    },
  },
  test: {
    globals: true,
    isolate: false,

    benchmark: {
      include: ['**/**.bench.ts'],
    },
  },
})
