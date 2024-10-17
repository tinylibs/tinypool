import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import { MessageChannel, type MessagePort, Worker } from 'node:worker_threads'
import {
  type RequestMessage,
  type ReadyMessage,
  type StartupMessage,
  type TinypoolWorker,
} from '../common'

export default class ThreadWorker implements TinypoolWorker {
  name = 'ThreadWorker'
  runtime = 'worker_threads'
  thread!: Worker
  threadId!: number
  port!: MessagePort
  workerPort!: MessagePort

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.thread = new Worker(
      fileURLToPath(import.meta.url + '/../entry/worker.js'),
      options
    )
    this.threadId = this.thread.threadId

    const { port1, port2 } = new MessageChannel()
    this.port = port1
    this.workerPort = port2

    port1.on('close', () => {
      // The port is only closed if the Worker stops for some reason, but we
      // always .unref() the Worker itself. We want to receive e.g. 'error'
      // events on it, so we ref it once we know it's going to exit anyway.
      this.ref?.()
    })
  }

  async terminate() {
    this.port.close()
    return this.thread.terminate()
  }

  initializeWorker(message: StartupMessage) {
    return this.thread.postMessage(
      {
        ...message,
        port: this.workerPort,
      },
      [this.workerPort]
    )
  }

  runTask(message: RequestMessage): void {
    this.port.ref()

    return this.port.postMessage(message, message.transferList)
  }

  onReady(callback: (...args: any[]) => void) {
    return this.thread.on('message', (message: ReadyMessage) => {
      if (message.ready === true) {
        return callback()
      }

      this.thread.emit(
        'error',
        new Error(`Unexpected message on Worker: ${inspect(message)}`)
      )
    })
  }

  onTaskFinished(listener: (...args: any[]) => void): void {
    this.port.on('message', listener)
  }

  onError(callback: (...args: any[]) => void) {
    return this.thread.on('error', callback)
  }

  onExit(callback: (...args: any[]) => void) {
    return this.thread.once('exit', callback)
  }

  ref() {
    return this.thread.ref()
  }

  unref() {
    return this.thread.unref()
  }

  setChannel() {
    throw new Error(
      "{ runtime: 'worker_threads' } doesn't support channel. Use transferListItem instead."
    )
  }
}
