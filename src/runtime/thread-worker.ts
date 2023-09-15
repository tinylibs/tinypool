import { fileURLToPath } from 'url'
import { TransferListItem, Worker } from 'worker_threads'
import { TinypoolWorker } from '../common'

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

  on(event: string, callback: (...args: any[]) => void) {
    return this.thread.on(event, callback)
  }

  once(event: string, callback: (...args: any[]) => void) {
    return this.thread.once(event, callback)
  }

  emit(event: string, ...data: any[]) {
    return this.thread.emit(event, ...data)
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
