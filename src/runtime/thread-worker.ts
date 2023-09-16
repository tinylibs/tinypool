import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { TransferListItem, Worker } from 'worker_threads'
import { TinypoolWorker } from '../common'

type Options = Parameters<TinypoolWorker['initialize']>[0]

const IS_BUN = process.versions.bun !== undefined
const BUN_UNSUPPORTED_OPTIONS = ['argv', 'execArgv', 'resourceLimits']

export default class ThreadWorker implements TinypoolWorker {
  name = 'ThreadWorker'
  runtime = 'worker_threads'
  thread!: Worker
  threadId!: number

  async initialize(options: Options) {
    const __dirname = dirname(fileURLToPath(import.meta.url))

    this.thread = new Worker(
      resolve(__dirname, './entry/worker.js'),
      removeUnsupportedOptions(options)
    )
    this.threadId = this.thread.threadId

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`${this.name} was unable to start`)),
        1_000
      )
      this.thread.once('online', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
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

function removeUnsupportedOptions(options: Options) {
  if (!IS_BUN) return options

  return Object.keys(options)
    .filter(
      (key): key is keyof Options => !BUN_UNSUPPORTED_OPTIONS.includes(key)
    )
    .reduce((all, key) => ({ ...all, [key]: options[key] }), {})
}
