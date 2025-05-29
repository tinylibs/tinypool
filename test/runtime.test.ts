import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Tinypool } from 'tinypool'
import EventEmitter from 'node:events'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('worker_threads', () => {
  test('runs code in worker_threads', async () => {
    const pool = createPool({ runtime: 'worker_threads' })

    const result = await pool.run(`
      (async () => {
        const workerThreads = await import("worker_threads");

        return {
          sum: 11 + 12,
          isMainThread: workerThreads.isMainThread,
          pid: process.pid,
        }
      })()
    `)
    expect(result.sum).toBe(23)
    expect(result.isMainThread).toBe(false)
    expect(result.pid).toBe(process.pid)
  })

  test('sets tinypool state', async () => {
    const pool = createPool({ runtime: 'worker_threads' })

    const result = await pool.run('process.__tinypool_state__')
    expect(result.isTinypoolWorker).toBe(true)
    expect(result.isWorkerThread).toBe(true)
    expect(result.isChildProcess).toBe(undefined)
  })

  test("worker's threadId is used as threadId", async () => {
    const pool = createPool({ runtime: 'worker_threads' })
    const threadId = pool.threads[0]!.threadId

    const result = await pool.run(`
      (async () => {
        const workerThreads = await import("worker_threads");
        return workerThreads.threadId;
      })()
    `)
    expect(result).toBe(threadId)
  })

  test('channel is closed when isolated', async () => {
    const pool = createPool({
      runtime: 'worker_threads',
      isolateWorkers: true,
      minThreads: 2,
      maxThreads: 2,
    })

    const events: string[] = []

    await pool.run('', { channel: { onClose: () => events.push('call #1') } })
    expect(events).toStrictEqual(['call #1'])

    await pool.run('', { channel: { onClose: () => events.push('call #2') } })
    expect(events).toStrictEqual(['call #1', 'call #2'])

    await pool.run('', { channel: { onClose: () => events.push('call #3') } })
    expect(events).toStrictEqual(['call #1', 'call #2', 'call #3'])

    await pool.destroy()
    expect(events).toStrictEqual(['call #1', 'call #2', 'call #3'])
  })

  test('channel is closed when non-isolated', async () => {
    const pool = createPool({
      runtime: 'worker_threads',
      isolateWorkers: false,
      minThreads: 2,
      maxThreads: 2,
    })

    const events: string[] = []

    await pool.run('', { channel: { onClose: () => events.push('call #1') } })
    expect(events).toStrictEqual([])

    await pool.run('', { channel: { onClose: () => events.push('call #2') } })
    expect(events).toStrictEqual(['call #1'])

    await pool.run('', { channel: { onClose: () => events.push('call #3') } })
    expect(events).toStrictEqual(['call #1', 'call #2'])

    await pool.destroy()
    expect(events).toStrictEqual(['call #1', 'call #2', 'call #3'])
  })
})

describe('child_process', () => {
  test('runs code in child_process', async () => {
    const pool = createPool({ runtime: 'child_process' })

    const result = await pool.run(`
    (async () => {
      const workerThreads = await import("worker_threads");

      return {
        sum: 11 + 12,
        isMainThread: workerThreads.isMainThread,
        pid: process.pid,
      }
    })()
  `)
    expect(result.sum).toBe(23)
    expect(result.isMainThread).toBe(true)
    expect(result.pid).not.toBe(process.pid)
  })

  test('sets tinypool state', async () => {
    const pool = createPool({ runtime: 'child_process' })

    const result = await pool.run('process.__tinypool_state__')
    expect(result.isTinypoolWorker).toBe(true)
    expect(result.isChildProcess).toBe(true)
    expect(result.isWorkerThread).toBe(undefined)
  })

  test("sub-process's process ID is used as threadId", async () => {
    const pool = createPool({ runtime: 'child_process' })
    const threadId = pool.threads[0]!.threadId

    const result = await pool.run('process.pid')
    expect(result).toBe(threadId)
  })

  test('child process workerId should be internal tinypool workerId', async () => {
    const pool = createPool({ runtime: 'child_process' })
    const workerId = await pool.run('process.__tinypool_state__.workerId')
    expect(workerId).toBe(1)
  })

  test('errors are serialized', async () => {
    const pool = createPool({ runtime: 'child_process' })

    const error = await pool
      .run("throw new TypeError('Test message');")
      .catch((e) => e)

    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('Test message')
    expect(error.stack).toMatch('fixtures/eval.js')
  })

  test('can send messages to port', async () => {
    const pool = createPool({
      runtime: 'child_process',
      filename: path.resolve(
        __dirname,
        'fixtures/child_process-communication.mjs'
      ),
    })

    const emitter = new EventEmitter()

    const startup = new Promise<void>((resolve) =>
      emitter.on(
        'response',
        (message) => message === 'Child process started' && resolve()
      )
    )

    const runPromise = pool.run('default', {
      channel: {
        onMessage: (callback) => emitter.on('message', callback),
        postMessage: (message) => emitter.emit('response', message),
      },
    })

    // Wait for the child process to start
    await startup

    const response = new Promise<any>((resolve) =>
      emitter.on(
        'response',
        (message) => message !== 'Hello from main' && resolve(message)
      )
    )

    // Send message to child process
    emitter.emit('message', 'Hello from main')

    // Wait for task to finish
    await runPromise

    // Wait for response from child
    const result = await response

    expect(result).toMatchObject({
      received: 'Hello from main',
      response: 'Hello from worker',
    })
  })

  test('channel is closed when isolated', async () => {
    const pool = createPool({
      runtime: 'child_process',
      isolateWorkers: true,
      minThreads: 2,
      maxThreads: 2,
    })

    const events: string[] = []

    await pool.run('', { channel: { onClose: () => events.push('call #1') } })
    expect(events).toStrictEqual(['call #1'])

    await pool.run('', { channel: { onClose: () => events.push('call #2') } })
    expect(events).toStrictEqual(['call #1', 'call #2'])

    await pool.run('', { channel: { onClose: () => events.push('call #3') } })
    expect(events).toStrictEqual(['call #1', 'call #2', 'call #3'])

    await pool.destroy()
    expect(events).toStrictEqual(['call #1', 'call #2', 'call #3'])
  })

  test('channel is closed when non-isolated', async () => {
    const pool = createPool({
      runtime: 'child_process',
      isolateWorkers: false,
      minThreads: 2,
      maxThreads: 2,
    })

    const events: string[] = []

    await pool.run('', { channel: { onClose: () => events.push('call #1') } })
    expect(events).toStrictEqual([])

    await pool.run('', { channel: { onClose: () => events.push('call #2') } })
    expect(events).toStrictEqual(['call #1'])

    await pool.run('', { channel: { onClose: () => events.push('call #3') } })
    expect(events).toStrictEqual(['call #1', 'call #2'])

    await pool.destroy()
    expect(events).toStrictEqual(['call #1', 'call #2', 'call #3'])
  })
})

test('runtime can be changed after recycle', async () => {
  const pool = createPool({ runtime: 'worker_threads' })
  const getState = 'process.__tinypool_state__'

  await expect(
    Promise.all([pool.run(getState), pool.run(getState)])
  ).resolves.toMatchObject([{ isWorkerThread: true }, { isWorkerThread: true }])

  await pool.recycleWorkers({ runtime: 'child_process' })

  await expect(
    Promise.all([pool.run(getState), pool.run(getState)])
  ).resolves.toMatchObject([{ isChildProcess: true }, { isChildProcess: true }])

  await pool.recycleWorkers({ runtime: 'worker_threads' })

  expect(await pool.run(getState)).toMatchObject({
    isWorkerThread: true,
  })
})

test('isolated idle workers change runtime after recycle', async () => {
  const pool = createPool({
    runtime: 'worker_threads',
    minThreads: 2,
    maxThreads: 2,
    isolateWorkers: true,
  })
  const getState = 'process.__tinypool_state__'

  await expect(pool.run(getState)).resolves.toMatchObject({
    isWorkerThread: true,
  })

  await pool.recycleWorkers({ runtime: 'child_process' })

  await expect(
    Promise.all([pool.run(getState), pool.run(getState)])
  ).resolves.toMatchObject([{ isChildProcess: true }, { isChildProcess: true }])
})

function createPool(options: Partial<Tinypool['options']>) {
  const pool = new Tinypool({
    filename: path.resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    ...options,
  })

  return pool
}
