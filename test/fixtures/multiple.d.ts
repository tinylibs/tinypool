export function a(): 'a'

export function b(): 'b'

export default a

export function identity<V>(v: V): V
export function identityAsync<V>(v: V): Promise<V>

export function foobar<V>(o: { foobar: V }): V
export function foobarAsync<V>(o: { foobar: V }): Promise<V>

export function args<A>(...args: A[]): A
export function argsAsync<A extends any[]>(...args: A): Promise<A>

export function firstArg(a: 1, b?: 2): 1
export function firstArgAsync(a: 2, b?: 3): Promise<2>

export const digit: 4

export function returnsAny(): any
