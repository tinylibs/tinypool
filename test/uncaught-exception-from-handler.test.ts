import { dirname, resolve, sep } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('uncaught exception resets Worker', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })

  await expect(pool.run('throw new Error("not_caught")')).rejects.toThrow(
    /not_caught/
  )
})

test('uncaught exception in immediate resets Worker', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })

  await expect(
    pool.run(`
    setImmediate(() => { throw new Error("not_caught") });
    new Promise(() => {}) // act as if we were doing some work
  `)
  ).rejects.toThrow(/not_caught/)
})

test('uncaught exception in immediate after task yields error event', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    useAtomics: false,
  })

  const errorEvent: Promise<Error[]> = once(pool, 'error')

  const taskResult = pool.run(`
    setTimeout(() => { throw new Error("not_caught") }, 500);
    42
  `)

  expect(await taskResult).toBe(42)

  // Hack a bit to make sure we get the 'exit'/'error' events.
  expect(pool.threads.length).toBe(1)
  pool.threads[0]!.ref?.()

  // This is the main aassertion here.
  expect((await errorEvent)[0]!.message).toEqual('not_caught')
})

test('using parentPort is treated as an error', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })
  await expect(
    pool.run(`
    (async () => {
      console.log();
      const parentPort = (await import('worker_threads')).parentPort;
      parentPort.postMessage("some message");
      new Promise(() => {}) /* act as if we were doing some work */
    })()
      `)
  ).rejects.toThrow(/Unexpected message on Worker: 'some message'/)
})

test('no named handler found from worker', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
  })

  let errorMessage = 'Worker did not throw error'

  try {
    await pool.run('', { name: 'someHandler' })
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error)
  }

  expect(
    errorMessage.replace(process.cwd(), '<process-cwd>').replaceAll(sep, '/')
  ).toMatchInlineSnapshot(
    `"No handler function "someHandler" exported from "<process-cwd>/test/fixtures/eval.js""`
  )
})
