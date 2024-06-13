import { bench } from 'vitest'
import { cpus } from 'node:os'
import { Worker } from 'node:worker_threads'
import { fork } from 'node:child_process'
import Tinypool, { type Options } from '../dist/index'

const THREADS = cpus().length - 1
const ROUNDS = THREADS * 10
const ITERATIONS = 100

for (const runtime of [
  'worker_threads',
  'child_process',
] as Options['runtime'][]) {
  bench(
    `Tinypool { runtime: '${runtime}' }`,
    async () => {
      const pool = new Tinypool({
        runtime,
        filename: './benchmark/fixtures/add.mjs',
        isolateWorkers: true,
        minThreads: THREADS,
        maxThreads: THREADS,
      })

      await Promise.all(
        Array(ROUNDS)
          .fill(0)
          .map(() => pool.run({ a: 1, b: 2 }))
      )

      await pool.destroy()
    },
    { iterations: ITERATIONS }
  )
}

for (const { task, name } of [
  { name: 'worker_threads', task: workerThreadTask },
  { name: 'child_process', task: childProcessTask },
] as const) {
  bench(
    `node:${name}`,
    async () => {
      const pool = Array(ROUNDS).fill(task)

      await Promise.all(
        Array(THREADS)
          .fill(execute)
          .map((_task) => _task())
      )

      async function execute() {
        const _task = pool.shift()

        if (_task) {
          await _task()
          return execute()
        }
      }
    },
    { iterations: ITERATIONS }
  )
}

async function workerThreadTask() {
  const worker = new Worker('./benchmark/fixtures/add-worker.mjs')
  const onMessage = new Promise<void>((resolve, reject) =>
    worker.on('message', (sum) => (sum === 3 ? resolve() : reject('Not 3')))
  )

  worker.postMessage({ a: 1, b: 2 })
  await onMessage

  await worker.terminate()
}

async function childProcessTask() {
  const subprocess = fork('./benchmark/fixtures/add-process.mjs')

  const onExit = new Promise((resolve) => subprocess.on('exit', resolve))
  const onMessage = new Promise<void>((resolve, reject) =>
    subprocess.on('message', (sum) => (sum === 3 ? resolve() : reject('Not 3')))
  )

  subprocess.send({ a: 1, b: 2 })
  await onMessage

  subprocess.kill()
  await onExit
}
