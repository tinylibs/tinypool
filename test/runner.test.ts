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

  expect(await runner.identity(123)).toBe(123)
  expect((await runner.identityAsync(123)) satisfies 123).toBe(123)

  expect(await runner.foobar({ foobar: 1 })).toBe(1)
  expect((await runner.foobarAsync({ foobar: 1 })) satisfies 1).toBe(1)

  expect((await runner.firstArg(1)) satisfies 1).toBe(1)
  expect((await runner.firstArgAsync(2)) satisfies 2).toBe(2)

  // @ts-expect-error should throw
  expect(() => runner.firstArg(1, 2)).toThrow('doesn’t support args array')
  // @ts-expect-error should throw
  expect(() => runner.firstArgAsync(2, 3)).toThrow('doesn’t support args array')
  // @ts-expect-error should throw
  expect(() => runner.args(1, 2, 3)).toThrow('doesn’t support args array')
  // @ts-expect-error should throw
  expect(() => runner.argsAsync(1, 2, 3)).toThrow('doesn’t support args array')
})

test('runner child_process test', async () => {
  const { runner } = new Tinypool({
    filename: resolve(__dirname, 'fixtures/multiple.js'),
    runtime: 'child_process',
  }).withRunner<typeof import('./fixtures/multiple.js')>()

  expect((await runner.a()) satisfies 'a').toBe('a')
  expect((await runner.b()) satisfies 'b').toBe('b')

  expect(await runner.identity(123)).toBe(123)
  expect((await runner.identityAsync(123)) satisfies 123).toBe(123)

  expect(await runner.foobar({ foobar: 1 })).toBe(1)
  expect((await runner.foobarAsync({ foobar: 1 })) satisfies 1).toBe(1)

  expect((await runner.firstArg(1)) satisfies 1).toBe(1)
  expect((await runner.firstArgAsync(2)) satisfies 2).toBe(2)

  // @ts-expect-error should throw
  expect(() => runner.firstArg(1, 2)).toThrow('doesn’t support args array')
  // @ts-expect-error should throw
  expect(() => runner.firstArgAsync(2, 3)).toThrow('doesn’t support args array')
  // @ts-expect-error should throw
  expect(() => runner.args(1, 2, 3)).toThrow('doesn’t support args array')
  // @ts-expect-error should throw
  expect(() => runner.argsAsync(1, 2, 3)).toThrow('doesn’t support args array')
})
