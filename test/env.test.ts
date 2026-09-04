import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHARE_ENV } from 'node:worker_threads'
import { Tinypool } from 'tinypool'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filename = path.resolve(__dirname, 'fixtures/eval.js')

const readEnv = (name: string) => `process.env[${JSON.stringify(name)}]`

describe('options.env', () => {
  test('accepts a plain object and passes it to worker_threads', async () => {
    const pool = new Tinypool({
      filename,
      runtime: 'worker_threads',
      minThreads: 1,
      maxThreads: 1,
      env: { TINYPOOL_TEST_PLAIN: 'plain' },
    })

    expect(await pool.run(readEnv('TINYPOOL_TEST_PLAIN'))).toBe('plain')
    await pool.destroy()
  })

  test('accepts a plain object and passes it to child_process', async () => {
    const pool = new Tinypool({
      filename,
      runtime: 'child_process',
      minThreads: 1,
      maxThreads: 1,
      env: { TINYPOOL_TEST_PLAIN: 'plain' },
    })

    expect(await pool.run(readEnv('TINYPOOL_TEST_PLAIN'))).toBe('plain')
    await pool.destroy()
  })

  // The type was `Record<string, string>`, and `process.env` is
  // `Record<string, string | undefined>` — so the documented default of
  // `new Worker(..., { env })` could not be written down (issue #136).
  test('accepts process.env, whose values are string | undefined', async () => {
    process.env.TINYPOOL_TEST_FROM_PROCESS_ENV = 'from-process-env'
    try {
      const pool = new Tinypool({
        filename,
        runtime: 'worker_threads',
        minThreads: 1,
        maxThreads: 1,
        env: process.env,
      })

      expect(await pool.run(readEnv('TINYPOOL_TEST_FROM_PROCESS_ENV'))).toBe(
        'from-process-env'
      )
      await pool.destroy()
    } finally {
      delete process.env.TINYPOOL_TEST_FROM_PROCESS_ENV
    }
  })

  test('accepts SHARE_ENV and actually shares the environment', async () => {
    const pool = new Tinypool({
      filename,
      runtime: 'worker_threads',
      minThreads: 1,
      maxThreads: 1,
      env: SHARE_ENV,
    })

    try {
      // Set *after* the worker started: under SHARE_ENV the two threads hold
      // one `process.env`, so the worker sees this without being restarted.
      // A copied environment would not, which is what makes this assert that
      // SHARE_ENV took effect rather than merely that it was accepted.
      process.env.TINYPOOL_TEST_SHARED = 'shared-after-start'

      expect(await pool.run(readEnv('TINYPOOL_TEST_SHARED'))).toBe(
        'shared-after-start'
      )
    } finally {
      delete process.env.TINYPOOL_TEST_SHARED
      await pool.destroy()
    }
  })

  // `ProcessWorker` forks with `{ ...options.env }`, and spreading a symbol
  // gives `{}` — so this combination would have started children with no
  // environment at all beyond TINYPOOL_WORKER_ID: no PATH, no HOME.
  test('refuses SHARE_ENV with runtime child_process', () => {
    expect(
      () =>
        new Tinypool({
          filename,
          runtime: 'child_process',
          env: SHARE_ENV,
        })
    ).toThrow(TypeError)

    expect(
      () =>
        new Tinypool({
          filename,
          runtime: 'child_process',
          env: SHARE_ENV,
        })
    ).toThrow(/SHARE_ENV/)
  })

  test('refuses recycling a SHARE_ENV pool onto child_process', async () => {
    // The constructor guard alone is bypassable: this is the one path that
    // moves an existing pool onto the runtime that cannot share.
    const pool = new Tinypool({
      filename,
      runtime: 'worker_threads',
      minThreads: 1,
      maxThreads: 1,
      env: SHARE_ENV,
    })

    await expect(
      pool.recycleWorkers({ runtime: 'child_process' })
    ).rejects.toThrow(/SHARE_ENV/)

    await pool.destroy()
  })

  test('still allows recycling a SHARE_ENV pool within worker_threads', async () => {
    // The control for the guard above: it must refuse the runtime that cannot
    // share, not recycling in general.
    const pool = new Tinypool({
      filename,
      runtime: 'worker_threads',
      minThreads: 1,
      maxThreads: 1,
      env: SHARE_ENV,
    })

    await expect(
      pool.recycleWorkers({ runtime: 'worker_threads' })
    ).resolves.not.toThrow()

    await pool.destroy()
  })
})
