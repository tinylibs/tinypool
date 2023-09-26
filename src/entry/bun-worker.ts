import {
  StartupMessage,
  ReadyMessage,
  RequestMessage,
  ResponseMessage,
} from '../common'
import { getHandler, throwInNextTick } from './utils'
import { stderr, stdout } from 'src/utils'

process.__tinypool_state__ = {
  isTinypoolWorker: true,
  isBunWorker: true,
  workerData: null,
  workerId: 1,
}

self.onmessage = onWorkerMessage

function onWorkerMessage(event: MessageEvent<StartupMessage>) {
  const { filename, name } = event.data

  ;(async function () {
    if (filename !== null) {
      await getHandler(filename, name)
    }

    const readyMessage: ReadyMessage = { ready: true }
    self.postMessage(readyMessage, '')
  })().catch(throwInNextTick)

  if (event.ports?.[0]) {
    event.ports[0].start()
    event.ports[0].onmessage = onPortMessage.bind(null, event.ports[0])
  }
}

function onPortMessage(port: MessagePort, event: MessageEvent<RequestMessage>) {
  const message = event.data
  const { taskId, task, filename, name } = message

  ;(async function () {
    let response: ResponseMessage

    try {
      const handler = await getHandler(filename, name)
      if (handler === null) {
        throw new Error(`No handler function exported from ${filename}`)
      }
      let result = await handler(task)
      response = {
        taskId,
        result: result,
        error: null,
        usedMemory: process.memoryUsage().heapUsed,
      }

      // If the task used e.g. console.log(), wait for the stream to drain
      // before potentially entering the `Atomics.wait()` loop, and before
      // returning the result so that messages will always be printed even
      // if the process would otherwise be ready to exit.
      if (stdout()?.writableLength! > 0) {
        await new Promise((resolve) => process.stdout.write('', resolve))
      }
      if (stderr()?.writableLength! > 0) {
        await new Promise((resolve) => process.stderr.write('', resolve))
      }
    } catch (error) {
      response = {
        taskId,
        result: null,
        error,
        usedMemory: process.memoryUsage().heapUsed,
      }
    }

    port.postMessage(response)
  })().catch(throwInNextTick)
}
