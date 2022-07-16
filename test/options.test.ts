import { amount as cpuCount } from '../src/physicalCpuCount'
import Tinypool from 'tinypool'

const testIf = (condition: boolean) => (condition ? test : test.skip)

describe('options', () => {
  // TODO mock amount instead?
  testIf(cpuCount > 1)('fractional thread limits can be set', async () => {
    const min = 0.5
    const max = 0.75
    const p = new Tinypool({
      minThreads: min,
      maxThreads: max,
    })

    expect(p.options.minThreads).toBe(Math.floor(cpuCount * min))
    expect(p.options.maxThreads).toBe(Math.floor(cpuCount * max))
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

  testIf(cpuCount > 2)(
    'fractional thread limits in the wrong order throw an error',
    async () => {
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
    }
  )
})
