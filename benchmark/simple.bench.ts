import { bench } from 'vitest'
import Tinypool from '../dist/index'

bench(
  'simple',
  async () => {
    const pool = new Tinypool({
      filename: './benchmark/fixtures/add.mjs',
    })

    const tasks: Promise<void>[] = []

    while (pool.queueSize === 0) {
      tasks.push(pool.run({ a: 4, b: 6 }))
    }

    await Promise.all(tasks)
    await pool.destroy()
  },
  { time: 10_000 }
)
