import { dirname, resolve } from 'path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'url'

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
