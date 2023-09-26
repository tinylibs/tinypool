import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import {
  TransferListItem,
  MessagePort as NodeMessagePort,
} from 'worker_threads'
import { TinypoolWorker, TinypoolChannel } from '../common'
import { StartupMessage } from 'tinypool'

let ids = 1

export default class BunWorker implements TinypoolWorker {
  name = 'BunWorker'
  runtime = 'bun_workers'
  worker!: Worker
  threadId!: number
  port?: NodeMessagePort
  channel?: TinypoolChannel
  waitForExit!: Promise<void>
  onExit!: () => void

  initialize(_: Parameters<TinypoolWorker['initialize']>[0]) {
    const __dirname = dirname(fileURLToPath(import.meta.url))

    this.worker = new Worker(resolve(__dirname, './entry/bun-worker.js'))
    this.threadId = ids++
    this.waitForExit = new Promise((resolve) => {
      this.onExit = resolve
    })
  }

  async terminate() {
    this.port?.close()
    this.worker.terminate()
    this.onExit()

    return this.waitForExit
  }

  postMessage(message: any, transferListItem?: Readonly<TransferListItem[]>) {
    transferListItem?.forEach((item) => {
      if (item instanceof NodeMessagePort) {
        this.port = item
      }
    })

    const channel = new MessageChannel()

    // Mirror port's messages to process
    this.port!.start()
    channel.port1.start()
    this.port!.on('message', (message) => {
      channel.port1.postMessage(message)
    })

    channel.port1.onmessage = (event) => {
      this.port!.postMessage(event.data)
    }
    this.port!.on('close', () => {
      channel.port1.close()
      channel.port2.close()
    })

    return this.worker.postMessage(
      <StartupMessage>{
        filename: message.filename,
        name: message.name,
      },
      [channel.port2]
    )
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (event === 'message') {
      this.worker.onmessage = (e) => callback(e.data)
    } else if (event === 'error') {
      this.worker.onerror = callback
    } else if (event === 'exit') {
      this.waitForExit.then(callback)
    } else {
      throw new Error(`Unknown event: ${event}`)
    }
  }

  once(event: string, callback: (...args: any[]) => void) {
    if (event === 'exit') {
      this.waitForExit.then(callback)
    } else {
      throw new Error(`Unknown event: ${event}`)
    }
  }

  emit(event: string, ..._data: any[]) {
    throw new Error(`Unknown emit event: ${event}`)
  }

  ref() {}

  unref() {}

  setChannel() {
    throw new Error('BunWorker does not support channel')
  }
}
