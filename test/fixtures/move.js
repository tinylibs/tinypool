import Tinypool from '../../dist/index.js'
import assert from 'assert'
import { types } from 'util'

export default function (moved) {
  if (moved !== undefined) {
    assert(types.isAnyArrayBuffer(moved))
  }
  return Tinypool.move(new ArrayBuffer(10))
}
