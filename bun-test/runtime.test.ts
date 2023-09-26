import * as path from 'path'
import { fileURLToPath } from 'url'
import { Tinypool } from '../dist/esm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Bun Workers', () => {
  test('runs code in Bun Worker', async () => {
    const pool = createPool({ runtime: 'bun_workers' })

    const result = await pool.run(`
      (async () => {
        return {
          sum: 11 + 12,
          isMainThread: Bun.isMainThread,
          pid: process.pid,
        }
      })()
    `)
    expect(result.sum).toBe(23)
    expect(result.isMainThread).toBe(false)
    expect(result.pid).toBe(process.pid)
  })

  test('sets tinypool state', async () => {
    const pool = createPool({ runtime: 'bun_workers' })

    const result = await pool.run('process.__tinypool_state__')
    expect(result.isTinypoolWorker).toBe(true)
    expect(result.isBunWorker).toBe(true)
    expect(result.isWorkerThread).toBe(undefined)
    expect(result.isChildProcess).toBe(undefined)
  })

  test('errors are serialized', async () => {
    const pool = createPool({ runtime: 'bun_workers' })

    const error = await pool
      .run("throw new TypeError('Test message');")
      .catch((e: Error) => e)

    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('Test message')

    // Nope Bun does not do this
    // expect(error.stack).toMatch('fixtures/eval.js')
  })
})

function createPool(options) {
  const pool = new Tinypool({
    filename: path.resolve(__dirname, './fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    ...options,
  })

  return pool
}
