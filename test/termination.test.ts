import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cleanups: (() => Promise<unknown>)[] = []

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

test('termination timeout throws when worker does not terminate in time', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    terminateTimeout: 10,
    minThreads: 1,
    maxThreads: 2,
    isolateWorkers: true,
  })

  expect(pool.threads.length).toBe(1)

  const worker = pool.threads[0]
  expect(worker).toBeTruthy()

  cleanups.push(worker!.terminate.bind(worker))
  worker!.terminate = () => new Promise(() => {})

  await expect(pool.run('default')).rejects.toThrowError(
    'Failed to terminate worker'
  )
})

test('writing to terminating worker does not crash', async () => {
  const listeners: ((msg: any) => void)[] = []

  const pool = new Tinypool({
    runtime: 'child_process',
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    minThreads: 1,
    maxThreads: 1,
  })

  await pool.run(
    {},
    {
      channel: {
        onMessage: (listener) => listeners.push(listener),
        postMessage: () => {},
      },
    }
  )

  const destroyed = pool.destroy()
  listeners.forEach((listener) => listener('Hello from main thread'))

  await destroyed
})

test('recycling workers while closing pool does not crash', async () => {
  const pool = new Tinypool({
    runtime: 'child_process',
    filename: resolve(__dirname, 'fixtures/nested-pool.mjs'),
    isolateWorkers: true,
    minThreads: 1,
    maxThreads: 1,
  })

  await Promise.all(
    (Array(10) as (() => Promise<any>)[])
      .fill(() => pool.run({}))
      .map((fn) => fn())
  )

  await pool.destroy()
})
