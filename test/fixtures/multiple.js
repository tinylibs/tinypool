'use strict'

export function a() {
  return 'a'
}

export function b() {
  return 'b'
}

export default a

export function foobar({ foobar }) {
  return foobar
}
export function asyncFoobar({ foobar }) {
  return foobar
}

export function args(...args) {
  return args
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function asyncArgs(...args) {
  return args
}

export const digit = 4

export function returnsAny() {
  return 'any'
}
