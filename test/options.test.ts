import { resolve } from 'node:path'
import { expect, test, vi } from 'vitest'

let Tinypool: typeof import('tinypool').default
const cpuCount = vi.hoisted(() => 100)

beforeAll(async () => {
  vi.resetModules()
  Tinypool = (await import('tinypool')).default
})

test('fractional thread limits can be set', async () => {
  const min = 0.5
  const max = 0.75
  const p = new Tinypool({
    minThreads: min,
    maxThreads: max,
  })

  expect(p.options.minThreads).toBe(cpuCount * min)
  expect(p.options.maxThreads).toBe(cpuCount * max)
})

test('fractional thread limits result is 1 for very low fractions', async () => {
  const min = 0.00005
  const max = 0.00006
  const p = new Tinypool({
    minThreads: min,
    maxThreads: max,
  })

  expect(p.options.minThreads).toBe(1)
  expect(p.options.maxThreads).toBe(1)
})

test('fractional thread limits in the wrong order throw an error', async () => {
  expect(() => {
    new Tinypool({
      minThreads: 0.75,
      maxThreads: 0.25,
    })
  }).toThrow()
  expect(() => {
    new Tinypool({
      minThreads: 0.75,
      maxThreads: 1,
    })
  }).toThrow()
})

test('ignores worker options from prototype', async () => {
  {
    const failsWhenLoaded = resolve(__dirname, 'fixtures/fails-when-loaded.mjs')

    onTestFinished(() => {
      // @ts-expect-error -- intentional
      delete Object.prototype.execArgv
      // @ts-expect-error -- intentional
      delete Object.prototype.env
    })

    // @ts-expect-error -- intentional
    Object.prototype.execArgv = ['--import', failsWhenLoaded]

    // @ts-expect-error -- intentional
    Object.prototype.env = { NODE_OPTIONS: `--import ${failsWhenLoaded}` }
  }

  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  const result = await worker.run('42')
  expect(result).toBe(42)
})

test('ignores worker filename from prototype', async () => {
  {
    const failsWhenLoaded = resolve(__dirname, 'fixtures/fails-when-loaded.mjs')

    onTestFinished(() => {
      // @ts-expect-error -- intentional
      delete Object.prototype.filename
    })

    // @ts-expect-error -- intentional
    Object.prototype.filename = failsWhenLoaded
  }

  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  const result = await worker.run('42', {
    signal: new AbortController().signal,
  })
  expect(result).toBe(42)
})

vi.mock(import('node:os'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    availableParallelism: () => cpuCount,
  }
})

vi.mock(import('node:child_process'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: { ...original.default, execSync: () => cpuCount as any },
  }
})
