import { dirname, resolve } from 'path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'url'

const sleep = async (num: number) =>
  await new Promise((res) => setTimeout(res, num))

const __dirname = dirname(fileURLToPath(import.meta.url))

test('can destroy pool while tasks are running', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  setImmediate(() => pool.destroy())
  expect(pool.run('while(1){}')).rejects.toThrow(/Terminating worker thread/)
})

test('destroy after initializing should work (#43)', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/sleep.js'),
    isolateWorkers: true,
  })

  expect(pool.run({})).rejects.toThrow(/Terminating worker thread/)
  setImmediate(() => pool.destroy())
})
