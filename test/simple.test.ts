import EventEmitter from 'events'
import { cpus } from 'os'
import { dirname, resolve } from 'path'
import Tinypool from 'tinypool'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sleep = async (num: number) =>
  await new Promise((res) => setTimeout(res, num))

test('basic test', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.js'),
  })
  const result = await worker.run(null)
  expect(result).toBe('done')
})

test('isWorkerThread correct value', async () => {
  expect(Tinypool.isWorkerThread).toBe(false)
})

test('Tinypool instance is an EventEmitter', async () => {
  const piscina = new Tinypool()
  expect(piscina instanceof EventEmitter).toBe(true)
})

test('Tinypool constructor options are correctly set', async () => {
  const piscina = new Tinypool({
    minThreads: 10,
    maxThreads: 20,
    maxQueue: 30,
  })

  expect(piscina.options.minThreads).toBe(10)
  expect(piscina.options.maxThreads).toBe(20)
  expect(piscina.options.maxQueue).toBe(30)
})
//
test('trivial eval() handler works', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  const result = await worker.run('42')
  expect(result).toBe(42)
})

test('async eval() handler works', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  const result = await worker.run('Promise.resolve(42)')
  expect(result).toBe(42)
})

test('filename can be provided while posting', async () => {
  const worker = new Tinypool()
  const result = await worker.run('Promise.resolve(42)', {
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  expect(result).toBe(42)
})

test('filename can be null when initially provided', async () => {
  const worker = new Tinypool({ filename: null })
  const result = await worker.run('Promise.resolve(42)', {
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  expect(result).toBe(42)
})

test('filename must be provided while posting', async () => {
  const worker = new Tinypool()
  expect(worker.run('doesn’t matter')).rejects.toThrow(
    /filename must be provided to run\(\) or in options object/
  )
})

test('passing env to workers works', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    env: { A: 'foo' },
  })

  const env = await pool.run('({...process.env})')
  expect(env).toEqual({ A: 'foo' })
})

test('passing argv to workers works', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    argv: ['a', 'b', 'c'],
  })

  const env = await pool.run('process.argv.slice(2)')
  expect(env).toEqual(['a', 'b', 'c'])
})

test('passing execArgv to workers works', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    execArgv: ['--no-warnings'],
  })

  const env = await pool.run('process.execArgv')
  expect(env).toEqual(['--no-warnings'])
})

test('passing valid workerData works', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/simple-workerdata.js'),
    workerData: 'ABC',
  })
  expect(Tinypool.workerData).toBe(undefined)

  await pool.run(null)
})

test('filename can be a file:// URL', async () => {
  const worker = new Tinypool({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/eval.js')).href,
  })
  const result = await worker.run('42')
  expect(result).toBe(42)
})

test('filename can be a file:// URL to an ESM module', async () => {
  const worker = new Tinypool({
    filename: pathToFileURL(resolve(__dirname, 'fixtures/esm-export.mjs')).href,
  })
  const result = await worker.run('42')
  expect(result).toBe(42)
})

test('named tasks work', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
  })

  expect(await worker.run({}, { name: 'a' })).toBe('a')
  expect(await worker.run({}, { name: 'b' })).toBe('b')
  expect(await worker.run({})).toBe('a')
})

test('named tasks work', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    name: 'b',
  })

  expect(await worker.run({}, { name: 'a' })).toBe('a')
  expect(await worker.run({}, { name: 'b' })).toBe('b')
  expect(await worker.run({})).toBe('b')
})

test('can destroy pool while tasks are running', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  setImmediate(() => pool.destroy())
  expect(async () => await pool.run('while(1){}')).rejects.toThrow(
    /Terminating worker thread/
  )
})

test('isolateWorkers: false', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/isolated.js'),
    isolateWorkers: false,
  })

  expect(await pool.run({})).toBe(0)
  expect(await pool.run({})).toBe(1)
  expect(await pool.run({})).toBe(2)
})

test('isolateWorkers: true', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/isolated.js'),
    isolateWorkers: true,
  })

  expect(await pool.run({})).toBe(0)
  expect(await pool.run({})).toBe(0)
  expect(await pool.run({})).toBe(0)
})

test('workerId should never be more than maxThreads=1', async () => {
  const maxThreads = 1
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/workerId.js'),
    isolateWorkers: true,
    maxThreads: maxThreads,
  })
  await pool.destroy()
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)

  await sleep(300)
})

test('workerId should never be more than maxThreads', async () => {
  const maxThreads = Math.floor(Math.random() * (4 - 1 + 1) + 1)
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/workerId.js'),
    isolateWorkers: true,
    maxThreads: maxThreads,
  })
  await pool.destroy()
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)
  expect(pool.run({})).resolves.toBeLessThanOrEqual(maxThreads)

  await sleep(300)
})

test('workerId should never be duplicated', async () => {
  const maxThreads = cpus().length + 4
  // console.log('maxThreads', maxThreads)
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/workerId.js'),
    isolateWorkers: true,
    // challenge tinypool
    maxThreads,
  })
  let duplicated = false
  const workerIds: number[] = []

  function addWorkerId(workerId: number) {
    if (workerIds.includes(workerId)) {
      duplicated = true
      // console.log('fucked')
    }
    workerIds.push(workerId)
  }

  const createWorkerId = async (): Promise<number> => {
    const result = await pool.run({})
    addWorkerId(result)
    return result
  }

  for (let i = 0; i < 20; i++) {
    if (duplicated) {
      continue
    }
    await Promise.all(
      new Array(maxThreads - 2).fill(0).map(() => createWorkerId())
    )
    workerIds.length = 0

    expect(duplicated).toBe(false)
  }

  await pool.destroy()
  await sleep(5000)
}, 30000)
