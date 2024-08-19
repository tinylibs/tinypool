import { expect, type Mock, test, vi } from 'vitest'
import os from 'node:os'
import childProcess from 'node:child_process'

const platform = os.platform as Mock
const cpus = os.cpus as Mock
const execSync = childProcess.execSync as Mock

beforeEach(() => {
  vi.resetModules()
})

describe('Linux', () => {
  beforeEach(() => {
    platform.mockImplementationOnce(() => 'linux')
  })

  test('returns cpus from cpuinfo', async () => {
    execSync
      .mockImplementationOnce(() => '20')
      .mockImplementationOnce(() => '40')

    const { amount } = await import('../src/physicalCpuCount')

    expect(amount).toBe(800)
  })

  test('returns cpus from node:os when cpuinfo returns 0', async () => {
    execSync.mockImplementationOnce(() => '0').mockImplementationOnce(() => '0')
    cpus.mockImplementation(() => Array(105))

    const { amount } = await import('../src/physicalCpuCount')

    expect(amount).toBe(105)
  })
})

describe('MacOS', () => {
  test('returns cpus from node:os', async () => {
    platform.mockImplementationOnce(() => 'darwin')
    execSync.mockImplementationOnce(() => '123.32')

    const { amount } = await import('../src/physicalCpuCount')

    expect(amount).toBe(123)
  })
})

describe('Windows', () => {
  test('returns cpus from node:os', async () => {
    platform.mockImplementationOnce(() => 'win32')
    cpus.mockImplementation(() => Array(101))

    const { amount } = await import('../src/physicalCpuCount')

    expect(amount).toBe(101)
  })
})

describe('Unknown OS', () => {
  test('returns cpus resolved from node:os', async () => {
    platform.mockImplementationOnce(() => 'custom')
    cpus.mockImplementation(() => [
      { model: 'Intel 1' },
      { model: 'AMD 1' },
      { model: 'Intel 2' },
      { model: 'Intel 3' },
      { model: 'AMD 2' },
    ])

    const { amount } = await import('../src/physicalCpuCount')

    expect(amount).toBe(3)
  })
})

vi.mock(import('node:os'), async (importOriginal) => {
  const original = await importOriginal()

  return {
    ...original,
    default: {
      ...original.default,
      platform: vi.fn().mockImplementation(original.platform),
      cpus: vi.fn().mockImplementation(original.cpus),
    },
  }
})

vi.mock(import('node:child_process'), async (importOriginal) => {
  const original = await importOriginal()

  return {
    ...original,
    default: {
      ...original.default,
      execSync: vi.fn().mockImplementation(original.execSync),
    },
  }
})
