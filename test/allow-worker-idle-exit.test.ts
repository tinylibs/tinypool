import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('uncaught exception after task yields error event (default)', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    useAtomics: false,
  })

  let errorEmitted: Error | undefined
  pool.on('error', (err) => {
    errorEmitted = err as Error
  })

  const taskResult = pool.run(`
    setTimeout(() => { throw new Error("not_caught") }, 200);
    42
  `)
  expect(await taskResult).toBe(42)

  // Wait long enough for the async throw + worker exit to propagate.
  await new Promise((r) => setTimeout(r, 600))

  expect(errorEmitted?.message).toEqual('not_caught')

  await pool.destroy()
})

test('uncaught exception after task does NOT yield error event when allowWorkerIdleExit is true', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/eval.js'),
    maxThreads: 1,
    useAtomics: false,
    allowWorkerIdleExit: true,
  })

  const errors: unknown[] = []
  pool.on('error', (err) => {
    errors.push(err)
  })

  const taskResult = pool.run(`
    setTimeout(() => { throw new Error("ignored_when_idle") }, 200);
    42
  `)
  expect(await taskResult).toBe(42)

  // Wait long enough for the async throw + worker exit to propagate.
  await new Promise((r) => setTimeout(r, 600))

  expect(errors).toEqual([])

  await pool.destroy()
})