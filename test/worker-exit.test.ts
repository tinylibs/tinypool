import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Tinypool } from 'tinypool'

const __dirname = dirname(fileURLToPath(import.meta.url))

test.each(['worker_threads', 'child_process'] as const)(
  '%s: rejects the in-flight task when a worker exits, and replaces the worker',
  async (runtime) => {
    const pool = new Tinypool({
      filename: resolve(__dirname, 'fixtures/eval.js'),
      runtime,
      minThreads: 1,
      maxThreads: 1,
    })

    try {
      await expect(pool.run('process.exit(1)')).rejects.toThrow(
        'Worker exited unexpectedly'
      )
      await expect(pool.run('42')).resolves.toBe(42)
    } finally {
      await pool.destroy()
    }
  }
)
