import { dirname, resolve } from 'node:path'
import { Tinypool } from 'tinypool'
import { fileURLToPath } from 'node:url'
import { MessageChannel } from 'node:worker_threads'
import { isBun } from './utils'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('isolated workers call teardown on worker recycle', async () => {
  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/teardown.mjs'),
    minThreads: 1,
    maxThreads: 1,
    isolateWorkers: true,
    teardown: 'namedTeardown',
  })

  for (const _ of [1, 2, 3, 4, 5]) {
    const { port1, port2 } = new MessageChannel()
    port2.start()
    const promise = new Promise((resolve) => port2.on('message', resolve))

    const output = await pool.run({ port: port1 }, { transferList: [port1] })
    expect(output).toBe('Output of task #1')

    await expect(promise).resolves.toBe('Teardown of task #1')
  }
})

test('non-isolated workers call teardown on worker recycle', async ({
  skip,
}) => {
  // TODO: Need to debug why `port2.off` does not behave as expected on Bun
  // It doe not clear the handler as well as not call `unexpectedTeardown` five times
  if (isBun) return skip('Teardown behave unexpected on bun')

  const pool = new Tinypool({
    filename: resolve(__dirname, 'fixtures/teardown.mjs'),
    minThreads: 1,
    maxThreads: 1,
    isolateWorkers: false,
    teardown: 'namedTeardown',
  })

  function unexpectedTeardown(message: string) {
    assert.fail(
      `Teardown should not have been called yet. Received "${message}"`
    )
  }

  const { port1, port2 } = new MessageChannel()
  port2.start()

  for (const index of [1, 2, 3, 4, 5]) {
    port2.on('message', unexpectedTeardown)

    const transferList = index === 1 ? [port1] : []

    const output = await pool.run({ port: transferList[0] }, { transferList })
    expect(output).toBe(`Output of task #${index}`)
  }

  port2.off('message', unexpectedTeardown)
  const promise = new Promise((resolve) => port2.on('message', resolve))

  await pool.destroy()
  await expect(promise).resolves.toMatchInlineSnapshot(`"Teardown of task #5"`)
})
