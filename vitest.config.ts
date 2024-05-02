import { dirname, resolve } from 'path'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

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

    // simple.test.ts expects to be run in main thread
    poolMatchGlobs: [['**/simple.test.ts', 'forks']],
  },
})
