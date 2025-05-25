import {
  parentPort,
  type MessagePort,
  receiveMessageOnPort,
  workerData as tinypoolData,
} from 'node:worker_threads'
import {
  type ReadyMessage,
  type RequestMessage,
  type ResponseMessage,
  type StartupMessage,
  type TinypoolData,
  kResponseCountField,
  kRequestCountField,
  isMovable,
  kTransferable,
  kValue,
} from '../common'
import { stderr, stdout } from '../utils'
import { getHandler, throwInNextTick } from './utils'

const [tinypoolPrivateData, workerData] = tinypoolData as TinypoolData

process.__tinypool_state__ = {
  isWorkerThread: true,
  isTinypoolWorker: true,
  workerData: workerData,
  workerId: tinypoolPrivateData.workerId,
}

const memoryUsage = process.memoryUsage.bind(process)
let useAtomics: boolean = process.env.PISCINA_DISABLE_ATOMICS !== '1'

// We should only receive this message once, when the Worker starts. It gives
// us the MessagePort used for receiving tasks, a SharedArrayBuffer for fast
// communication using Atomics, and the name of the default filename for tasks
// (so we can pre-load and cache the handler).
parentPort!.on('message', (message: StartupMessage) => {
  useAtomics =
    process.env.PISCINA_DISABLE_ATOMICS === '1' ? false : message.useAtomics

  const { port, sharedBuffer, filename, name } = message

  ;(async function () {
    if (filename !== null) {
      await getHandler(filename, name)
    }

    const readyMessage: ReadyMessage = { ready: true }
    parentPort!.postMessage(readyMessage)

    port.on('message', onMessage.bind(null, port, sharedBuffer))
    atomicsWaitLoop(port, sharedBuffer)
  })().catch(throwInNextTick)
})

let currentTasks: number = 0
let lastSeenRequestCount: number = 0
function atomicsWaitLoop(port: MessagePort, sharedBuffer: Int32Array) {
  if (!useAtomics) return

  // This function is entered either after receiving the startup message, or
  // when we are done with a task. In those situations, the *only* thing we
  // expect to happen next is a 'message' on `port`.
  // That call would come with the overhead of a C++ → JS boundary crossing,
  // including async tracking. So, instead, if there is no task currently
  // running, we wait for a signal from the parent thread using Atomics.wait(),
  // and read the message from the port instead of generating an event,
  // in order to avoid that overhead.
  // The one catch is that this stops asynchronous operations that are still
  // running from proceeding. Generally, tasks should not spawn asynchronous
  // operations without waiting for them to finish, though.
  while (currentTasks === 0) {
    // Check whether there are new messages by testing whether the current
    // number of requests posted by the parent thread matches the number of
    // requests received.
    Atomics.wait(sharedBuffer, kRequestCountField, lastSeenRequestCount)
    lastSeenRequestCount = Atomics.load(sharedBuffer, kRequestCountField)

    // We have to read messages *after* updating lastSeenRequestCount in order
    // to avoid race conditions.
    let entry
    while ((entry = receiveMessageOnPort(port)) !== undefined) {
      onMessage(port, sharedBuffer, entry.message)
    }
  }
}

function onMessage(
  port: MessagePort,
  sharedBuffer: Int32Array,
  message: RequestMessage
) {
  currentTasks++
  const { taskId, task, filename, name } = message

  ;(async function () {
    let response: ResponseMessage
    let transferList: any[] = []
    try {
      const handler = await getHandler(filename, name)
      if (handler === null) {
        throw new Error(
          `No handler function "${name}" exported from "${filename}"`
        )
      }
      let result = await handler(task)
      if (isMovable(result)) {
        transferList = transferList.concat(result[kTransferable])
        result = result[kValue]
      }
      response = {
        taskId,
        result: result,
        error: null,
        usedMemory: memoryUsage().heapUsed,
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
        // It may be worth taking a look at the error cloning algorithm we
        // use in Node.js core here, it's quite a bit more flexible
        error,
        usedMemory: memoryUsage().heapUsed,
      }
    }
    currentTasks--

    // Post the response to the parent thread, and let it know that we have
    // an additional message available. If possible, use Atomics.wait()
    // to wait for the next message.
    port.postMessage(response, transferList)
    Atomics.add(sharedBuffer, kResponseCountField, 1)
    atomicsWaitLoop(port, sharedBuffer)
  })().catch(throwInNextTick)
}
