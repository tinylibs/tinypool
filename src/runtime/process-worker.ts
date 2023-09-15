import { ChildProcess, fork } from 'child_process'
import { MessagePort, TransferListItem } from 'worker_threads'
import { fileURLToPath } from 'url'
import {
  TinypoolChannel,
  TinypoolWorker,
  TinypoolWorkerMessage,
} from '../common'

const __tinypool_worker_message__ = true
const SIGKILL_TIMEOUT = 1000

export default class ProcessWorker implements TinypoolWorker {
  name = 'ProcessWorker'
  runtime = 'child_process'
  process!: ChildProcess
  threadId!: number
  port?: MessagePort
  channel?: TinypoolChannel
  waitForExit!: Promise<void>

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.process = fork(
      fileURLToPath(import.meta.url + '/../entry/process.js'),
      options
    )
    this.threadId = this.process.pid!

    this.process.on('exit', this.onUnexpectedExit)
    this.waitForExit = new Promise((r) => this.process.on('exit', r))
  }

  onUnexpectedExit = () => {
    this.process.emit('error', new Error('Worker exited unexpectedly'))
  }

  async terminate() {
    this.process.off('exit', this.onUnexpectedExit)

    const sigkillTimeout = setTimeout(
      () => this.process.kill('SIGKILL'),
      SIGKILL_TIMEOUT
    )

    this.process.kill()
    await this.waitForExit

    this.port?.close()
    clearTimeout(sigkillTimeout)
  }

  setChannel(channel: TinypoolChannel) {
    this.channel = channel

    // Mirror channel's messages to process
    this.channel.onMessage((message: any) => {
      this.process.send(message)
    })
  }

  postMessage(message: any, transferListItem?: Readonly<TransferListItem[]>) {
    transferListItem?.forEach((item) => {
      if (item instanceof MessagePort) {
        this.port = item
      }
    })

    // Mirror port's messages to process
    if (this.port) {
      this.port.on('message', (message) =>
        this.process.send(<TinypoolWorkerMessage<'port'>>{
          ...message,
          source: 'port',
          __tinypool_worker_message__,
        })
      )
    }

    return this.process.send(<TinypoolWorkerMessage<'pool'>>{
      ...message,
      source: 'pool',
      __tinypool_worker_message__,
    })
  }

  on(event: string, callback: (...args: any[]) => void) {
    return this.process.on(event, (data: TinypoolWorkerMessage) => {
      // All errors should be forwarded to the pool
      if (event === 'error') {
        return callback(data)
      }

      if (!data || !data.__tinypool_worker_message__) {
        return this.channel?.postMessage(data)
      }

      if (data.source === 'pool') {
        callback(data)
      } else if (data.source === 'port') {
        this.port!.postMessage(data)
      }
    })
  }

  once(event: string, callback: (...args: any[]) => void) {
    return this.process.once(event, callback)
  }

  emit(event: string, ...data: any[]) {
    return this.process.emit(event, ...data)
  }

  ref() {
    return this.process.ref()
  }

  unref() {
    this.port?.unref()

    // The forked child_process adds event listener on `process.on('message)`.
    // This requires manual unreffing of its channel.
    this.process.channel?.unref()

    return this.process.unref()
  }
}
