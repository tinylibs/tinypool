import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      tinypool: resolve('./dist/esm/index.js'),
    },
  },
  test: {
    globals: true,

    // simple.test.ts expects to be run in main thread
    poolMatchGlobs: [['**/simple.test.ts', 'child_process']],
  },
})
