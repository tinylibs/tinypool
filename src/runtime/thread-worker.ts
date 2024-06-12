import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import { type TransferListItem, Worker } from 'node:worker_threads'
import { type ReadyMessage, type TinypoolWorker } from '../common'

export default class ThreadWorker implements TinypoolWorker {
  name = 'ThreadWorker'
  runtime = 'worker_threads'
  thread!: Worker
  threadId!: number

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.thread = new Worker(
      fileURLToPath(import.meta.url + '/../entry/worker.js'),
      options
    )
    this.threadId = this.thread.threadId
  }

  async terminate() {
    return this.thread.terminate()
  }

  postMessage(message: any, transferListItem?: Readonly<TransferListItem[]>) {
    return this.thread.postMessage(message, transferListItem)
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
