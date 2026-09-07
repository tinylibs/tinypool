'use strict'

export function a() {
  return 'a'
}

export function b() {
  return 'b'
}

export default a

export function identity(v) {
  return v
}
export function identityAsync(v) {
  return v
}

export function foobar({ foobar }) {
  return foobar
}
export function foobarAsync({ foobar }) {
  return foobar
}

export function args(...args) {
  return args
}
// eslint-disable-next-line @typescript-eslint/require-await
export async function argsAsync(...args) {
  return args
}
export function firstArg(a) {
  return a
}
// eslint-disable-next-line @typescript-eslint/require-await
export async function firstArgAsync(a) {
  return a
}

export const digit = 4

export function returnsAny() {
  return 'any'
}
