import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe.each(['worker_threads', 'child_process'] as const)('%s', (runtime) => {
  test('idle workers can be recycled', async () => {
    const pool = new Tinypool({
      runtime,
      filename: resolve(__dirname, 'fixtures/sleep.js'),
      minThreads: 4,
      maxThreads: 4,
      isolateWorkers: false,
    })

    function getThreadIds() {
      return pool.threads
        .map((thread) => thread!.threadId)
        .sort((a, b) => a - b)
    }

    expect(pool.threads).toHaveLength(4)
    const initialThreadIds = getThreadIds()

    await Promise.all(times(4)(() => pool.run({})))
    expect(getThreadIds()).toStrictEqual(initialThreadIds)

    await pool.recycleWorkers()
    expect(pool.threads).toHaveLength(4)

    const newThreadIds = getThreadIds()
    initialThreadIds.forEach((id) => expect(newThreadIds).not.toContain(id))

    await Promise.all(times(4)(() => pool.run({})))
    initialThreadIds.forEach((id) => expect(newThreadIds).not.toContain(id))
    expect(getThreadIds()).toStrictEqual(newThreadIds)
  })

  test('running workers can recycle after task execution finishes', async () => {
    const pool = new Tinypool({
      runtime,
      filename: resolve(__dirname, 'fixtures/sleep.js'),
      minThreads: 4,
      maxThreads: 4,
      isolateWorkers: false,
    })

    function getThreadIds() {
      return pool.threads
        .map((thread) => thread!.threadId)
        .sort((a, b) => a - b)
    }

    expect(pool.threads).toHaveLength(4)
    const initialThreadIds = getThreadIds()

    const tasks = [
      ...times(2)(() => pool.run({ time: 1 })),
      ...times(2)(() => pool.run({ time: 2000 })),
    ]

    // Wait for first two tasks to finish
    await Promise.all(tasks.slice(0, 2))

    await pool.recycleWorkers()
    const threadIds = getThreadIds()

    // Idle workers should have been recycled immediately
    // Running workers should not have recycled yet
    expect(intersection(threadIds, initialThreadIds)).toHaveLength(2)

    await Promise.all(tasks)

    // All workers should have recycled now
    const newThreadIds = getThreadIds()
    initialThreadIds.forEach((id) => expect(newThreadIds).not.toContain(id))
  })
})

function times(count: number) {
  return function run<T>(fn: () => T): T[] {
    return Array(count).fill(0).map(fn)
  }
}

function intersection<T>(a: T[], b: T[]) {
  return a.filter((value) => b.includes(value))
}
