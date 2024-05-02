import Tinypool from '../dist/index.js'

async function simpleBenchmark({ duration = 10000 } = {}) {
  const pool = new Tinypool({
    filename: new URL('./fixtures/add.mjs', import.meta.url).href,
  })
  let done = 0

  const results = []
  const start = process.hrtime.bigint()
  while (pool.queueSize === 0) {
    results.push(scheduleTasks())
  }

  async function scheduleTasks() {
    while ((process.hrtime.bigint() - start) / 1_000_000n < duration) {
      await pool.run({ a: 4, b: 6 })
      done++
    }
  }

  await Promise.all(results)

  return (done / duration) * 1e3
}

const opsPerSecond = await simpleBenchmark()
console.log(`opsPerSecond: ${opsPerSecond}`)
