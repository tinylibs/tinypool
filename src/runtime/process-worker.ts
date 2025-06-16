import { type ChildProcess, fork } from 'node:child_process'
import { MessagePort, type TransferListItem } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import {
  type TinypoolChannel,
  type TinypoolWorker,
  type TinypoolWorkerMessage,
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
  isTerminating = false

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.process = fork(
      fileURLToPath(import.meta.url + '/../entry/process.js'),
      options.argv,
      {
        ...options,
        stdio: 'pipe',
        env: {
          ...options.env,
          TINYPOOL_WORKER_ID: options.workerData[0].workerId.toString(),
        },
      }
    )

    process.stdout.setMaxListeners(1 + process.stdout.getMaxListeners())
    process.stderr.setMaxListeners(1 + process.stderr.getMaxListeners())
    this.process.stdout?.pipe(process.stdout)
    this.process.stderr?.pipe(process.stderr)

    this.threadId = this.process.pid!

    this.process.on('exit', this.onUnexpectedExit)
    this.waitForExit = new Promise((r) => this.process.on('exit', r))
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

    this.process.stdout?.unpipe(process.stdout)
    this.process.stderr?.unpipe(process.stderr)
    this.port?.close()
    this.channel?.onClose?.()
    clearTimeout(sigkillTimeout)
  }

  setChannel(channel: TinypoolChannel) {
    // Previous channel exists in non-isolated runs
    if (this.channel && this.channel !== channel) {
      this.channel.onClose?.()
    }

    this.channel = channel

    // Mirror channel's messages to process
    this.channel.onMessage?.((message: any) => {
      this.send(message)
    })
  }

  private send(message: Parameters<NonNullable<(typeof process)['send']>>[0]) {
    if (!this.isTerminating) {
      this.process.send(message)
    }
  }

  postMessage(message: any, transferListItem?: Readonly<TransferListItem[]>) {
    transferListItem?.forEach((item) => {
      if (item instanceof MessagePort) {
        this.port = item
        this.port.start()
      }
    })

    // Mirror port's messages to process
    if (this.port) {
      this.port.on('message', (message) =>
        this.send(<TinypoolWorkerMessage<'port'>>{
          ...message,
          source: 'port',
          __tinypool_worker_message__,
        })
      )
    }

    return this.send(<TinypoolWorkerMessage<'pool'>>{
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
        return this.channel?.postMessage?.(data)
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
    this.process.channel?.unref?.()

    if (hasUnref(this.process.stdout)) {
      this.process.stdout.unref()
    }

    if (hasUnref(this.process.stderr)) {
      this.process.stderr.unref()
    }

    return this.process.unref()
  }
}

// unref is untyped for some reason
function hasUnref(stream: null | object): stream is { unref: () => void } {
  return (
    stream != null && 'unref' in stream && typeof stream.unref === 'function'
  )
}
