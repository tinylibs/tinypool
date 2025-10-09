import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const delay = promisify(setTimeout)

describe('destroy() timeout', () => {
  test('destroy() should timeout when workers fail to exit', async () => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      minThreads: 2,
      maxThreads: 2,
    })

    // Run a task to ensure workers are spawned
    await pool.run('42')

    // Mock worker.terminate() to simulate a worker that never exits
    const workers = pool.threads
    const originalTerminate = workers[0].terminate
    workers.forEach((worker) => {
      worker.terminate = () => new Promise(() => {}) // Never resolves
    })

    // destroy() should timeout and throw error
    await expect(pool.destroy({ timeout: 500 })).rejects.toThrow(
      /Failed to terminate worker pool/i
    )

    // Cleanup: restore original terminate and force kill
    workers.forEach((worker) => {
      worker.terminate = originalTerminate
      worker.terminate().catch(() => {})
    })
  }, 10000)

  test('destroy() should succeed when workers exit normally', async () => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      minThreads: 2,
      maxThreads: 2,
    })

    await pool.run('42')

    // Should complete without timeout
    await expect(pool.destroy({ timeout: 5000 })).resolves.toBeUndefined()
  })

  test('destroy() should work without timeout option (backwards compatibility)', async () => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      minThreads: 1,
      maxThreads: 1,
    })

    await pool.run('1 + 1')

    // Should work with no timeout (existing behavior)
    await expect(pool.destroy()).resolves.toBeUndefined()
  })

  test('destroy() should cleanup all workers within timeout', async () => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      minThreads: 4,
      maxThreads: 4,
    })

    // Run multiple tasks
    await Promise.all([
      pool.run('1'),
      pool.run('2'),
      pool.run('3'),
      pool.run('4'),
    ])

    const startTime = Date.now()
    await pool.destroy({ timeout: 3000 })
    const endTime = Date.now()

    // Should complete well before timeout
    expect(endTime - startTime).toBeLessThan(2000)
  })
})
