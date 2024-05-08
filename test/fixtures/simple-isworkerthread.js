import Tinypool from '../../dist/index.js'
import assert from 'assert'

assert.strictEqual(Tinypool.isWorkerThread, true)

export default function () {
  return 'done'
}
