import { parentPort } from 'node:worker_threads'

import add from './add.mjs'

parentPort.on('message', (message) => {
  parentPort.postMessage(add(message))
})
