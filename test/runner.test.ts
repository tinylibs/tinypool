import { dirname, resolve } from 'node:path'
import Tinypool from 'tinypool'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('runner worker_threads test', async () => {
  const { runner } = new Tinypool({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    runtime: 'worker_threads',
  }).withRunner<typeof import('./fixtures/multiple.js')>()

  expect((await runner.a()) satisfies 'a').toBe('a')
  expect((await runner.b()) satisfies 'b').toBe('b')
  expect(await runner.foobar({ foobar: 1 })).toBe(1)
  expect((await runner.asyncFoobar({ foobar: 1 })) satisfies 1).toBe(1)
  expect(await runner.args(1, 2, 3, { foobar: 1 })).toEqual([
    1,
    2,
    3,
    { foobar: 1 },
  ])
  expect(
    (await runner.asyncArgs(1, 2, 3, { foobar: 1 })) satisfies [
      1,
      2,
      3,
      { foobar: 1 },
    ]
  ).toEqual([1, 2, 3, { foobar: 1 }])
})

test('runner child_process test', async () => {
  const { runner } = new Tinypool({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    runtime: 'child_process',
  }).withRunner<typeof import('./fixtures/multiple.js')>()

  expect((await runner.a()) satisfies 'a').toBe('a')
  expect((await runner.b()) satisfies 'b').toBe('b')
  expect(await runner.foobar({ foobar: 1 })).toBe(1)
  expect((await runner.asyncFoobar({ foobar: 1 })) satisfies 1).toBe(1)
  expect(await runner.args('baz')).toStrictEqual(['baz'])
  expect(
    (await runner.asyncArgs('baz' as const)) satisfies ['baz']
  ).toStrictEqual(['baz'])

  expect(() => runner.args(1, 2, 3)).toThrow(
    'doesn’t support args array in child_process runtime'
  )
  expect(() => runner.asyncArgs(1, 2, 3)).toThrow(
    'doesn’t support args array in child_process runtime'
  )
})
