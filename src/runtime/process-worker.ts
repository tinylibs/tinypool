import { type ChildProcess, fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  type RequestMessage,
  type ReadyMessage,
  type StartupMessage,
  type TinypoolChannel,
  type TinypoolWorker,
  type TinypoolWorkerMessage,
  type ResponseMessage,
} from '../common'

const __tinypool_worker_message__ = true
const SIGKILL_TIMEOUT = 1000

export default class ProcessWorker implements TinypoolWorker {
  name = 'ProcessWorker'
  runtime = 'child_process'
  process!: ChildProcess
  threadId!: number
  channel?: TinypoolChannel
  waitForExit!: Promise<void>
  isTerminating = false

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.process = fork(
      fileURLToPath(import.meta.url + '/../entry/process.js'),
      options.argv,
      {
        ...options,
        env: {
          ...options.env,
          TINYPOOL_WORKER_ID: options.workerData[0].workerId.toString(),
        },
      }
    )
    this.threadId = this.process.pid!

    this.process.on('exit', this.onUnexpectedExit)
    this.waitForExit = new Promise((r) => this.process.on('exit', r))

    this.process.on('message', (data: TinypoolWorkerMessage) => {
      if (!data || !data.__tinypool_worker_message__) {
        return this.channel?.postMessage(data)
      }
    })
  }

  onUnexpectedExit = () => {
    this.process.emit('error', new Error('Worker exited unexpectedly'))
  }

  async terminate() {
    this.isTerminating = true
    this.process.off('exit', this.onUnexpectedExit)

    const sigkillTimeout = setTimeout(
      () => this.process.kill('SIGKILL'),
      SIGKILL_TIMEOUT
    )

    this.process.kill()
    await this.waitForExit

    clearTimeout(sigkillTimeout)
  }

  setChannel(channel: TinypoolChannel) {
    this.channel = channel

    // Mirror channel's messages to process
    this.channel.onMessage((message: any) => {
      this.send(message)
    })
  }

  private send(message: Parameters<NonNullable<(typeof process)['send']>>[0]) {
    if (!this.isTerminating) {
      this.process.send(message)
    }
  }

  initializeWorker(message: StartupMessage) {
    return this.send(<TinypoolWorkerMessage<'pool'>>{
      ...message,
      source: 'pool',
      __tinypool_worker_message__,
    })
  }

  runTask(message: RequestMessage): void {
    return this.send(<TinypoolWorkerMessage<'port'>>{
      ...message,
      source: 'port',
      __tinypool_worker_message__,
    })
  }

  onReady(callback: (...args: any[]) => void) {
    return this.process.on(
      'message',
      (data: TinypoolWorkerMessage & ReadyMessage) => {
        if (
          data.__tinypool_worker_message__ === true &&
          data.source === 'pool' &&
          data.ready === true
        ) {
          callback()
        }
      }
    )
  }

  onTaskFinished(callback: (...args: any[]) => void) {
    return this.process.on(
      'message',
      (data: TinypoolWorkerMessage & ResponseMessage) => {
        if (
          data.__tinypool_worker_message__ === true &&
          data.source === 'port'
        ) {
          callback(data)
        }
      }
    )
  }

  onError(callback: (...args: any[]) => void) {
    return this.process.on('error', (data) => {
      // All errors should be forwarded to the pool
      return callback(data)
    })
  }

  onExit(callback: (...args: any[]) => void) {
    if (this.isTerminating) {
      return callback()
    }

    return this.process.once('exit', callback)
  }

  ref() {
    return this.process.ref()
  }

  unref() {
    // The forked child_process adds event listener on `process.on('message)`.
    // This requires manual unreffing of its channel.
    this.process.channel?.unref()

    return this.process.unref()
  }
}
