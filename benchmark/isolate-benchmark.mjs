/*
 * Benchmark focusing on the performance `isolateWorkers` option
 *
 * Options:
 * - `--rounds` (optional) - Specify how many iterations to run
 * - `--threads` (optional) - Specify how many threads to use
 */

import * as os from 'node:os'
import * as WorkerThreads from 'node:worker_threads'

import Tinypool from '../dist/esm/index.js'

const IS_BUN = process.versions.bun !== undefined
const USE_ATOMICS = !IS_BUN
const THREADS = parseInt(getArgument('--threads') ?? getMaxThreads(), 10)
const ROUNDS = parseInt(getArgument('--rounds') ?? '5_000', 10)

console.log('Options:', { THREADS, ROUNDS, IS_BUN }, '\n')

await logTime(
  "Tinypool { runtime: 'worker_threds' }",
  runTinypool('worker_threds')
)
await logTime(
  "Tinypool { runtime: 'child_process' }",
  runTinypool('child_process')
)

if (IS_BUN) {
  await logTime('Native Bun workers', runBunWorkers())
}

await logTime('Native node:worker_threads', runNodeWorkerThreads())

function runTinypool(runtime) {
  const pool = new Tinypool({
    runtime,
    filename: new URL('./fixtures/add.mjs', import.meta.url).href,
    isolateWorkers: true,
    minThreads: THREADS,
    maxThreads: THREADS,
    useAtomics: USE_ATOMICS,
  })

  return async function run() {
    await Promise.all(
      Array(ROUNDS)
        .fill()
        .map(() => pool.run({ a: 1, b: 2 }))
    )
  }
}

function runNodeWorkerThreads() {
  async function task() {
    const worker = new WorkerThreads.Worker('./fixtures/wrap-add.mjs')
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

  return async function run() {
    await Promise.all(
      Array(THREADS)
        .fill(execute)
        .map((task) => task())
    )
  }
}

function runBunWorkers() {
  async function task() {
    const worker = new Worker('./fixtures/wrap-add-bun.mjs')
    worker.postMessage({ a: 1, b: 2 })

    await new Promise((resolve, reject) => {
      worker.onmessage = (event) =>
        event.data === 3 ? resolve() : reject('Not 3')
    })

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

  return async function run() {
    await Promise.all(
      Array(THREADS)
        .fill(execute)
        .map((task) => task())
    )
  }
}

function getArgument(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return

  return process.argv[index + 1]
}

function getMaxThreads() {
  return os.availableParallelism?.() || os.cpus().length - 1
}

async function logTime(label, method) {
  console.log(`${label} | START`)

  const start = process.hrtime.bigint()
  await method()
  const end = process.hrtime.bigint()

  console.log(`${label} | END   ${((end - start) / 1_000_000n).toString()} ms`)

  console.log('Cooling down for 2s')
  const interval = setInterval(() => process.stdout.write('.'), 100)
  await sleep(2_000)
  clearInterval(interval)
  console.log(' ✓\n')
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
