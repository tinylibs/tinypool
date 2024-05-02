/*
 * Benchmark for testing whether Tinypool's worker creation and teardown is expensive.
 */
import { cpus } from 'node:os'
import { Worker } from 'node:worker_threads'

import Tinypool from '../dist/index.js'

const THREADS = cpus().length - 1
const ROUNDS = 5_000

await logTime('Tinypool', runTinypool)
await logTime('Worker threads', runWorkerThreads)

async function runTinypool() {
  const pool = new Tinypool({
    filename: new URL('./fixtures/add.mjs', import.meta.url).href,
    isolateWorkers: true,
    minThreads: THREADS,
    maxThreads: THREADS,
  })

  await Promise.all(
    Array(ROUNDS)
      .fill()
      .map(() => pool.run({ a: 1, b: 2 }))
  )
}

async function runWorkerThreads() {
  async function task() {
    const worker = new Worker('./fixtures/wrap-add.mjs')
    worker.postMessage({ a: 1, b: 2 })

    await new Promise((resolve, reject) =>
      worker.on('message', (sum) => (sum === 3 ? resolve() : reject('Not 3')))
    )

    await worker.terminate()
  }

  const pool = Array(ROUNDS).fill(task)

  async function execute() {
    const task = pool.shift()

    if (task) {
      await task()
      return execute()
    }
  }

  await Promise.all(
    Array(THREADS)
      .fill(execute)
      .map((task) => task())
  )
}

async function logTime(label, method) {
  const start = process.hrtime.bigint()
  await method()
  const end = process.hrtime.bigint()
  console.log(label, 'took', ((end - start) / 1_000_000n).toString(), 'ms')
}
