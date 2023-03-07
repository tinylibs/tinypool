import { dirname, resolve } from 'path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cleanups: (() => Promise<unknown>)[] = []

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

test('termination timeout throws when worker does not terminate in time', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    terminateTimeout: 10,
    minThreads: 1,
    maxThreads: 2,
    isolateWorkers: true,
  })

  expect(pool.threads.length).toBe(1)

  const worker = pool.threads[0]
  expect(worker).toBeTruthy()

  cleanups.push(worker!.terminate.bind(worker))
  worker!.terminate = () => new Promise(() => {})

  await expect(pool.run('default')).rejects.toThrowError(
    'Failed to terminate worker'
  )
})
