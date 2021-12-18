import Tinypool from '../../dist/esm/index.js'
import assert from 'assert'

assert.strictEqual(Tinypool.isWorkerThread, true)

export default function () {
  return 'done'
}
