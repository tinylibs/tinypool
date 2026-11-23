import { dirname, resolve } from 'node:path'
import { Tinypool, type Task, type TaskQueue } from 'tinypool'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe.each(['worker_threads', 'child_process'] as const)('%s', (runtime) => {
  test.each(['queued', 'skipped'])(
    'aborts a %s task without running it',
    async (state) => {
      const pool = new Tinypool({
        runtime,
        filename: resolve(__dirname, 'fixtures/eval.js'),
        minThreads: 1,
        maxThreads: 1,
        concurrentTasksPerWorker: 2,
      })
      const firstTask = pool.run(
        'new Promise(resolve => { globalThis.finishTask = resolve })'
      )
      const secondTask = pool.run('42')
      const runningTasks = Promise.allSettled([firstTask, secondTask])
      const signal = new EventEmitter()
      const abortedTask = pool
        .run('globalThis.abortedTaskRan = true', { signal })
        .catch((error) => error)

      try {
        if (state === 'skipped') {
          // Finishing one task moves the abortable task into skipQueue while
          // the other task is still occupying the worker.
          await secondTask
        }

        expect(() => signal.emit('abort')).not.toThrow()
        expect(await abortedTask).toMatchObject({ name: 'AbortError' })
        expect(pool.queueSize).toBe(0)

        await secondTask
        await pool.run('globalThis.finishTask("finished")')
        expect(await firstTask).toBe('finished')
        expect(await pool.run('Boolean(globalThis.abortedTaskRan)')).toBe(false)
      } finally {
        await pool.destroy()
        await runningTasks
      }
    }
  )
})

test('will put items into a task queue until they can run', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.js'),
    minThreads: 2,
    maxThreads: 3,
  })
  expect(pool.threads.length).toBe(2)
  expect(pool.queueSize).toBe(0)

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
  ]

  const results = []

  results.push(pool.run(buffers[0]))
  expect(pool.threads.length).toBe(2)
  expect(pool.queueSize).toBe(0)

  results.push(pool.run(buffers[1]))
  expect(pool.threads.length).toBe(2)
  expect(pool.queueSize).toBe(0)

  results.push(pool.run(buffers[2]))
  expect(pool.threads.length).toBe(3)
  expect(pool.queueSize).toBe(0)

  results.push(pool.run(buffers[3]))
  expect(pool.threads.length).toBe(3)
  expect(pool.queueSize).toBe(1)

  for (const buffer of buffers) {
    Atomics.store(buffer, 0, 1)
    Atomics.notify(buffer, 0, 1)
  }

  await results[0]
  expect(pool.queueSize).toBe(0)

  await Promise.all(results)
})

test('will reject items over task queue limit', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 2,
  })
  const promises: Promise<void>[] = []

  expect(pool.threads.length).toBe(0)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /Terminating worker thread/
    )
  )

  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /Terminating worker thread/
    )
  )
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(1)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /Terminating worker thread/
    )
  )
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(2)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /Task queue is at limit/
    )
  )

  await pool.destroy()
  await Promise.all(promises)
})

test('will reject items when task queue is unavailable', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0,
  })
  const promises: Promise<void>[] = []

  expect(pool.threads.length).toBe(0)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /Terminating worker thread/
    )
  )
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /No task queue available and all Workers are busy/
    )
  )

  await pool.destroy()
  await Promise.all(promises)
})

test('will reject items when task queue is unavailable (fixed thread count)', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    maxQueue: 0,
  })
  const promises: Promise<void>[] = []

  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /Terminating worker thread/
    )
  )
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(pool.run('while (true) {}')).rejects.toThrow(
      /No task queue available and all Workers are busy/
    )
  )

  await pool.destroy()
  await Promise.all(promises)
})

test('tasks can share a Worker if requested (both tests blocking)', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.js'),
    minThreads: 0,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2,
  })
  const promises: Promise<void>[] = []

  expect(pool.threads.length).toBe(0)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(
      pool.run(new Int32Array(new SharedArrayBuffer(4)))
    ).rejects.toBeTruthy()
  )
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  promises.push(
    expect(
      pool.run(new Int32Array(new SharedArrayBuffer(4)))
    ).rejects.toBeTruthy()
  )
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  await pool.destroy()
  await Promise.all(promises)
})

test('tasks can share a Worker if requested (both tests finish)', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/wait-for-notify.js'),
    minThreads: 1,
    maxThreads: 1,
    maxQueue: 0,
    concurrentTasksPerWorker: 2,
  })

  const buffers = [
    new Int32Array(new SharedArrayBuffer(4)),
    new Int32Array(new SharedArrayBuffer(4)),
  ] as const

  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  const firstTask = pool.run(buffers[0])
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  const secondTask = pool.run(buffers[1])
  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)

  Atomics.store(buffers[0] as any, 0, 1)
  Atomics.store(buffers[1] as any, 0, 1)
  Atomics.notify(buffers[0] as any, 0, 1)
  Atomics.notify(buffers[1] as any, 0, 1)
  Atomics.wait(buffers[0] as any, 0, 1)
  Atomics.wait(buffers[1] as any, 0, 1)

  await firstTask
  expect(buffers[0][0]).toBe(-1)
  await secondTask
  expect(buffers[1][0]).toBe(-1)

  expect(pool.threads.length).toBe(1)
  expect(pool.queueSize).toBe(0)
})

test('custom task queue works', async () => {
  let sizeCalled: boolean = false
  let shiftCalled: boolean = false
  let pushCalled: boolean = false

  class CustomTaskPool implements TaskQueue {
    tasks: Task[] = []

    get size(): number {
      sizeCalled = true
      return this.tasks.length
    }

    shift(): Task | null {
      shiftCalled = true
      return this.tasks.length > 0 ? (this.tasks.shift() as Task) : null
    }

    push(task: Task): void {
      pushCalled = true
      this.tasks.push(task)

      expect(Tinypool.queueOptionsSymbol in task).toBeTruthy()
      if ((task as any).task.a === 3) {
        // @ts-expect-error -- intentional
        expect(task[Tinypool.queueOptionsSymbol]).toBeNull()
      } else {
        // @ts-expect-error -- intentional
        expect(task[Tinypool.queueOptionsSymbol].option).toEqual(
          (task as any).task.a
        )
      }
    }

    remove(task: Task): void {
      const index = this.tasks.indexOf(task)
      this.tasks.splice(index, 1)
    }

    cancel() {}
  }

  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    taskQueue: new CustomTaskPool(),
    // Setting maxThreads low enough to ensure we queue
    maxThreads: 1,
    minThreads: 1,
  })

  function makeTask(task: any, option: any) {
    return { ...task, [Tinypool.queueOptionsSymbol]: { option } }
  }

  const ret = await Promise.all([
    pool.run(makeTask({ a: 1 }, 1)),
    pool.run(makeTask({ a: 2 }, 2)),
    pool.run({ a: 3 }), // No queueOptionsSymbol attached
  ])

  expect(ret[0].a).toBe(1)
  expect(ret[1].a).toBe(2)
  expect(ret[2].a).toBe(3)

  expect(sizeCalled).toBeTruthy()
  expect(pushCalled).toBeTruthy()
  expect(shiftCalled).toBeTruthy()
})

test('queued tasks can be cancelled', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    minThreads: 0,
    maxThreads: 1,
  })

  const time = 2000
  const taskCount = 10

  const promises = []
  let finishedTasks = 0
  let cancelledTasks = 0

  for (const _ of Array(taskCount)) {
    const promise = pool
      .run({ time })
      .then(() => {
        finishedTasks++
      })
      .catch((error) => {
        if (error.message !== 'The task has been cancelled') {
          throw error
        }
        cancelledTasks++
      })
    promises.push(promise)
  }

  // Wait for the first task to start
  await new Promise((resolve) => setTimeout(resolve, time / 2))
  expect(pool.queueSize).toBe(taskCount - 1)

  // One task is running, cancel the pending ones
  pool.cancelPendingTasks()

  // The first task should still be on-going, pending ones should have started their cancellation
  expect(finishedTasks).toBe(0)
  expect(pool.queueSize).toBe(0)

  await Promise.all(promises)

  expect({ finishedTasks, cancelledTasks }).toEqual({
    finishedTasks: 1,
    cancelledTasks: taskCount - 1,
  })
})
