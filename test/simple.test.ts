import EventEmitter from 'events'
import { dirname, resolve } from 'path'
import Tinypool from 'tinypool'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('basic test', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.js'),
  })
  const result = await worker.run(null)
  expect(result).toBe('done')
})

test('Tinypool instance is an EventEmitter', async () => {
  const piscina = new Tinypool()
  expect(piscina instanceof EventEmitter).toBe(true)
})
//

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
  expect(await pool.run({})).toBe(1)
  expect(await pool.run({})).toBe(2)
  expect(await pool.run({})).toBe(3)
})

test('isolateWorkers: true', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/isolated.js'),
    isolateWorkers: true,
  })
  expect(await pool.run({})).toBe(1)
  expect(await pool.run({})).toBe(1)
  expect(await pool.run({})).toBe(1)
})
