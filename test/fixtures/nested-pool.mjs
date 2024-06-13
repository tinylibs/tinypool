import { cpus } from 'node:os'
import { Tinypool } from 'tinypool'

export default async function nestedPool() {
  const pool = new Tinypool({
    filename: new URL(import.meta.url, import.meta.url).href,
    runtime: 'child_process',
    isolateWorkers: true,
    minThreads: cpus().length - 1,
    maxThreads: cpus().length - 1,
  })

  await Promise.resolve()
  pool.recycleWorkers()
}

export function entrypoint() {}
