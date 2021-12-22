import { dirname, resolve } from 'path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('can destroy pool while tasks are running', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  setImmediate(() => pool.destroy())
  expect(pool.run('while(1){}')).rejects.toThrow(/Terminating worker thread/)
})
