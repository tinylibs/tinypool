import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isBun = 'bun' in process.versions

export default defineConfig({
  resolve: {
    alias: {
      tinypool: resolve(__dirname, './dist/index.js'),
    },
  },
  test: {
    globals: true,
    isolate: false,

    poolOptions: {
      /**
       * There is an issue with Vitest that is causing a weird Temporal Disposal Zone (TDZ) issue
       * when used with multi-process with Bun.
       * ReferenceError: Cannot access 'dispose' before initialization.
       *  ❯ disposeInternalListeners node_modules/.pnpm/vitest@3.1.4_@types+node@20.12.8/node_modules/vitest/dist/chunks/utils.BfxieIyZ.js:19:19
       *
       * So we have to switch to single fork to run our tests in the Bun until resolved.
       */
      forks: isBun
        ? {
            singleFork: true,
          }
        : {},
    },

    benchmark: {
      include: ['**/**.bench.ts'],
    },
  },
})
