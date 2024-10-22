export function a(): 'a'

export function b(): 'b'

export default a

export function foobar<V>(o: { foobar: V }): V
export function asyncFoobar<V>(o: { foobar: V }): Promise<V>

export function args<A>(...args: A[]): A
export function asyncArgs<A extends any[]>(...args: A): Promise<A>

export const digit: 4

export function returnsAny(): any
