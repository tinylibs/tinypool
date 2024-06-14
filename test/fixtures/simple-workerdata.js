import Tinypool from '../../dist/index.js'
import assert from 'node:assert'

assert.strictEqual(Tinypool.workerData, 'ABC')

export default function () {
  return 'done'
}
