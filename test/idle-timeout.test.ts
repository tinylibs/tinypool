import { promisify } from 'util'
import { dirname, resolve } from 'path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const delay = promisify(setTimeout)
test('idle timeout will let go of threads early', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/wait-for-others.js'),
    idleTimeout: 500,
    minThreads: 1,
    maxThreads: 2,
  })

  expect(pool.threads.length).toBe(1)
  const buffer = new Int32Array(new SharedArrayBuffer(4))

  const firstTasks = [pool.run([buffer, 2]), pool.run([buffer, 2])]
  expect(pool.threads.length).toBe(2)

  const earlyThreadIds = await Promise.all(firstTasks)
  expect(pool.threads.length).toBe(2)

  await delay(2000)
  expect(pool.threads.length).toBe(1)

  const secondTasks = [pool.run([buffer, 4]), pool.run([buffer, 4])]
  expect(pool.threads.length).toBe(2)

  const lateThreadIds = await Promise.all(secondTasks)

  // One thread should have been idle in between and exited, one should have
  // been reused.
  expect(earlyThreadIds.length).toBe(2)
  expect(lateThreadIds.length).toBe(2)
  expect(new Set([...earlyThreadIds, ...lateThreadIds]).size).toBe(3)
})
