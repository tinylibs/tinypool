import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import { Tinypool } from 'tinypool'
import { isBun } from './utils'

const runtimes = ['worker_threads', 'child_process'] as const
const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.each(runtimes)(
  "worker's stdout and stderr are piped to main thread when { runtime: '%s' }",
  // TODO: std options are not yet supported in Bun
  { skip: isBun },
  async (runtime) => {
    const pool = createPool({
      runtime,
      minThreads: 1,
      maxThreads: 1,
    })

    const getStdout = captureStandardStream('stdout')
    const getStderr = captureStandardStream('stderr')

    await pool.run({})

    const stdout = getStdout()
    const stderr = getStderr()

    expect(stdout).toMatch('Worker message')

    expect(stderr).toMatch('Worker error')
  }
)

function createPool(options: Partial<Tinypool['options']>) {
  const pool = new Tinypool({
    filename: path.resolve(__dirname, 'fixtures/stdio.mjs'),
    minThreads: 1,
    maxThreads: 1,
    ...options,
  })

  return pool
}

function captureStandardStream(type: 'stdout' | 'stderr') {
  const spy = vi.fn()

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const original = process[type].write
  process[type].write = spy

  return function collect() {
    process[type].write = original
    return stripVTControlCharacters(
      spy.mock.calls.map((call) => call[0]).join('')
    )
  }
}
