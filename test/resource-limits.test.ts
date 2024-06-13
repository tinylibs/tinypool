import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('resourceLimits causes task to reject', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/resource-limits.js'),
    resourceLimits: {
      maxOldGenerationSizeMb: 4,
      maxYoungGenerationSizeMb: 2,
      codeRangeSizeMb: 4,
    },
  })
  worker.on('error', () => {
    // Ignore any additional errors that may occur.
    // This may happen because when the Worker is
    // killed a new worker is created that may hit
    // the memory limits immediately. When that
    // happens, there is no associated Promise to
    // reject so we emit an error event instead.
    // We don't care so much about that here. We
    // could potentially avoid the issue by setting
    // higher limits above but rather than try to
    // guess at limits that may work consistently,
    // let's just ignore the additional error for
    // now.
  })
  const limits: any = worker.options.resourceLimits
  expect(limits.maxOldGenerationSizeMb).toBe(4)
  expect(limits.maxYoungGenerationSizeMb).toBe(2)
  expect(limits.codeRangeSizeMb).toBe(4)
  expect(worker.run(null)).rejects.toThrow(
    /Worker terminated due to reaching memory limit: JS heap out of memory/
  )
})

describe.each(['worker_threads', 'child_process'] as const)('%s', (runtime) => {
  test('worker is recycled after reaching maxMemoryLimitBeforeRecycle', async () => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/leak-memory.js'),
      maxMemoryLimitBeforeRecycle: 10_000_000,
      isolateWorkers: false,
      minThreads: 1,
      maxThreads: 1,
      runtime,
    })

    const originalWorkerId = pool.threads[0]?.threadId
    expect(originalWorkerId).toBeGreaterThan(0)

    let finalThreadId = originalWorkerId
    let rounds = 0

    // This is just an estimate of how to leak "some" memory - it's not accurate.
    // Running 100 loops should be enough to make the worker reach memory limit and be recycled.
    // Use the `rounds` to make sure we don't reach the limit on the first round.
    for (const _ of Array(100).fill(0)) {
      await pool.run(10_000)

      if (pool.threads[0]) {
        finalThreadId = pool.threads[0].threadId
      }

      if (finalThreadId !== originalWorkerId) {
        break
      }

      rounds++
    }

    // Test setup should not reach max memory on first round
    expect(rounds).toBeGreaterThan(1)

    // Thread should have been recycled
    expect(finalThreadId).not.toBe(originalWorkerId)
  })

  test('recycled workers should not crash pool (regression)', async () => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/leak-memory.js'),
      maxMemoryLimitBeforeRecycle: 10,
      isolateWorkers: false,
      minThreads: 2,
      maxThreads: 2,
      runtime,
    })

    // This should not crash the pool
    await Promise.all(
      Array(10)
        .fill(0)
        .map(() => pool.run(10_000))
    )
  })
})
