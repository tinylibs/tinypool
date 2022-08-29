import { resolve } from 'path'
import { Bench } from 'tinybench'

const bench = new Bench({ iterations: 100 })

bench
  .add('tinybench@0.2.4 with async_hooks', async () => {
    // 0.2.4
    const { Tinypool } = (await import(
      // @ts-ignore
      './dist/esm/index.js'
    )) as typeof import('./dist/')

    const worker = new Tinypool({
      filename: resolve(__dirname, '../test/fixtures/simple-isworkerthread.js'),
    })
    await worker.run(null)
  })
  .add('tinybench without async_hooks', async () => {
    const { Tinypool } = await import('../dist/esm/index.js')

    const worker = new Tinypool({
      filename: resolve(__dirname, '../test/fixtures/simple-isworkerthread.js'),
    })
    await worker.run(null)
  })

test('basic', async () => {
  await bench.run()
  const old = bench.getTask('tinybench@0.2.4 with async_hooks')
  const latest = bench.getTask('tinybench without async_hooks')
  console.log({ ...old }, { ...latest })
}, 100000)
