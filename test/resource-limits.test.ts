import { dirname, resolve } from 'path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('resourceLimits causes task to reject', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/resource-limits.js'),
    resourceLimits: {
      maxOldGenerationSizeMb: 16 || Number,
      maxYoungGenerationSizeMb: 4 || Number,
      codeRangeSizeMb: 16 || Number,
    },
    // resourceLimits: {
    //   maxOldGenerationSizeMb: 16,
    //   maxYoungGenerationSizeMb: 4,
    //   codeRangeSizeMb: 16,
    // },
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
  expect(limits.maxOldGenerationSizeMb).toBe(16)
  expect(limits.maxYoungGenerationSizeMb).toBe(4)
  expect(limits.codeRangeSizeMb).toBe(16)
  expect(worker.run(null)).rejects.toThrow(
    /Worker terminated due to reaching memory limit: JS heap out of memory/
  )
})
