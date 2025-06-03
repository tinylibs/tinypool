import { createHook, executionAsyncId } from 'node:async_hooks'
import { Tinypool } from 'tinypool'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBun } from './utils'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('postTask() calls the correct async hooks', async ({ skip }) => {
  // Async context tracking via createHook is highly experimental and even suggested by NodeJS migrate away from this.
  // https://nodejs.org/docs/latest/api/async_hooks.html#async-hooks
  // Experimental. Please migrate away from this API, if you can. We do not recommend using the createHook, AsyncHook,
  // and executionAsyncResource APIs as they have usability issues, safety risks, and performance implications.
  if (isBun) return skip('AsyncHooks are not yet supported in Bun')

  let taskId: number
  let initCalls = 0
  let beforeCalls = 0
  let afterCalls = 0
  let resolveCalls = 0

  const hook = createHook({
    init(id, type) {
      if (type === 'Tinypool.Task') {
        initCalls++
        taskId = id
      }
    },
    before(id) {
      if (id === taskId) beforeCalls++
    },
    after(id) {
      if (id === taskId) afterCalls++
    },
    promiseResolve() {
      if (executionAsyncId() === taskId) resolveCalls++
    },
  })
  hook.enable()

  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })

  await pool.run('42')

  hook.disable()
  expect(initCalls).toBe(1)
  expect(beforeCalls).toBe(1)
  expect(afterCalls).toBe(1)
  expect(resolveCalls).toBe(1)
})
