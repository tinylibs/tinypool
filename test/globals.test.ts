import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Tinypool } from 'tinypool'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe.each(['worker_threads', 'child_process'] as const)('%s', (runtime) => {
  test("doesn't hang when process is overwritten", async () => {
    const pool = createPool({ runtime })

    const result = await pool.run(`
    (async () => {
      return new Promise(resolve => {
        globalThis.process = { exit: resolve };
        process.exit("exit() from overwritten process");
      });
    })();
    `)
    expect(result).toBe('exit() from overwritten process')
  })
})

function createPool(options: Partial<Tinypool['options']>) {
  const pool = new Tinypool({
    filename: path.resolve(__dirname, 'fixtures/eval.js'),
    minThreads: 1,
    maxThreads: 1,
    ...options,
  })

  return pool
}
