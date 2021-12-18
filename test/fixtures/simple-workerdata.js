import Tinypool from '../../dist/esm/index.js'
import assert from 'assert'

assert.strictEqual(Tinypool.workerData, 'ABC')

export default function () {
  return 'done'
}
