import { createHook, executionAsyncId } from 'node:async_hooks'
import { Tinypool } from 'tinypool'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('postTask() calls the correct async hooks', async () => {
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
