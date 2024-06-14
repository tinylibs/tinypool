import Tinypool from '../../dist/index.js'
import assert from 'node:assert'

assert.strictEqual(Tinypool.isWorkerThread, true)

export default function () {
  return 'done'
}
