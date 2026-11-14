import { fileURLToPath } from 'node:url'
import { type TransferListItem, Worker } from 'node:worker_threads'
import { type TinypoolWorker, type TinypoolChannel } from '../common'

export default class ThreadWorker implements TinypoolWorker {
  name = 'ThreadWorker'
  runtime = 'worker_threads'
  thread!: Worker
  threadId!: number
  channel?: TinypoolChannel
  isTerminating = false
  hasErrored = false

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.thread = new Worker(
      fileURLToPath(import.meta.url + '/../entry/worker.js'),
      options
    )
    this.threadId = this.thread.threadId

    this.thread.on('error', this.onError)
    this.thread.on('exit', this.onExit)
  }

  onError = () => {
    this.hasErrored = true
  }

  // A worker that throws emits 'error' first and 'exit' afterwards, so 'exit'
  // is only unexpected when no error was reported before it.
  onExit = () => {
    if (!this.isTerminating && !this.hasErrored) {
      this.thread.emit('error', new Error('Worker exited unexpectedly'))
    }
  }

  async terminate() {
    this.isTerminating = true
    this.thread.off('exit', this.onExit)

    const output = await this.thread.terminate()

    this.channel?.onClose?.()

    return output
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

  setChannel(channel: TinypoolChannel) {
    if (channel.onMessage) {
      throw new Error(
        "{ runtime: 'worker_threads' } doesn't support channel.onMessage. Use transferListItem for listening to messages instead."
      )
    }

    if (channel.postMessage) {
      throw new Error(
        "{ runtime: 'worker_threads' } doesn't support channel.postMessage. Use transferListItem for sending to messages instead."
      )
    }

    // Previous channel exists in non-isolated runs
    if (this.channel && this.channel !== channel) {
      this.channel.onClose?.()
    }

    this.channel = channel
  }
}
