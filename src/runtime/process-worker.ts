import { ChildProcess, fork } from 'child_process'
import { MessagePort, TransferListItem } from 'worker_threads'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  SpawnMessage,
  TinypoolChannel,
  TinypoolWorker,
  TinypoolWorkerMessage,
} from '../common'
import { StartupMessage } from 'tinypool'

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

  async initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    const __dirname = dirname(fileURLToPath(import.meta.url))

    this.process = fork(resolve(__dirname, './entry/process.js'), options)
    this.threadId = this.process.pid!

    this.process.on('exit', this.onUnexpectedExit)
    this.waitForExit = new Promise((r) => this.process.on('exit', r))

    // Wait for the worker to emit `SpawnMessage`
    // In Bun the child_process does not emit 'spawn' event and doesn't start immediately
    // when .fork() is called. All messages that are sent to it are ignored if it hasn't yet started.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timeout starting ProcessWorker')),
        2_000
      )

      this.process.once('message', (message: SpawnMessage) => {
        if (message?.spawned) {
          resolve()
          clearTimeout(timeout)
        }
      })
    })
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

  postMessage(
    message: StartupMessage,
    transferListItem?: Readonly<TransferListItem[]>
  ) {
    transferListItem?.forEach((item) => {
      if (item instanceof MessagePort) {
        this.port = item
      }
    })

    // Mirror port's messages to process
    if (this.port) {
      this.port.start()
      this.port.on('message', (message) => {
        this.process.send(<TinypoolWorkerMessage<'port'>>{
          ...message,
          source: 'port',
          __tinypool_worker_message__,
        })
      })
    }

    // Do not pass thread related options to process
    const { port, sharedBuffer, useAtomics, ...serializableMessage } = message

    return this.process.send(<TinypoolWorkerMessage<'pool'>>{
      ...serializableMessage,
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
