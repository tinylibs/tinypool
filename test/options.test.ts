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

vi.mock(import('node:os'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: { ...original.default, cpus: () => Array(cpuCount) },
  }
})

vi.mock(import('node:child_process'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: { ...original.default, execSync: () => cpuCount },
  }
})
