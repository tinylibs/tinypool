import { createHook } from 'node:async_hooks'
import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('can destroy pool while tasks are running', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  setImmediate(() => void pool.destroy())
  await expect(pool.run('while(1){}')).rejects.toThrow(
    /Terminating worker thread/
  )
})

test('destroy after initializing should work (#43)', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    isolateWorkers: true,
  })

  const promise = expect(pool.run({})).rejects.toThrow(
    /Terminating worker thread/
  )

  setImmediate(() => void pool.destroy())
  await promise
})

test('cleans up async resources', async () => {
  let onCleanup = () => {}
  const waitForCleanup = new Promise<void>((r) => (onCleanup = r))
  const timeout = setTimeout(() => {
    throw new Error('Timeout waiting for async resource destroying')
  }, 2_000).unref()

  const ids = new Set<number>()

  const hook = createHook({
    init(asyncId, type) {
      if (type === 'Tinypool') {
        ids.add(asyncId)
      }
    },
    destroy(asyncId) {
      if (ids.has(asyncId)) {
        ids.delete(asyncId)
        onCleanup()
        clearTimeout(timeout)
      }
    },
  })
  hook.enable()

  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    minThreads: 1,
  })

  await pool.run('42')

  expect(ids.size).toBe(1)

  await pool.destroy()
  await waitForCleanup

  expect(ids.size).toBe(0)
  hook.disable()
})
