import type { MessagePort, TransferListItem } from 'worker_threads'

/** Channel for communicating between main thread and workers */
export interface TinypoolChannel {
  /** Workers subscribing to messages */
  onMessage(callback: (message: any) => void): void

  /** Called with worker's messages */
  postMessage(message: any): void
}

export interface TinypoolWorker {
  runtime: string
  initialize(options: {
    env?: Record<string, string>
    argv?: string[]
    execArgv?: string[]
    resourceLimits?: any
    workerData: TinypoolData
    trackUnmanagedFds?: boolean
  }): void
  terminate(): Promise<any>
  postMessage(message: any, transferListItem?: TransferListItem[]): void
  setChannel?: (channel: TinypoolChannel) => void
  on(event: string, listener: (...args: any[]) => void): void
  once(event: string, listener: (...args: any[]) => void): void
  emit(event: string, ...data: any[]): void
  ref?: () => void
  unref?: () => void
  threadId: number
}

/**
 * Tinypool's internal messaging between main thread and workers.
 * - Utilizers can use `__tinypool_worker_message__` property to identify
 *   these messages and ignore them.
 */
export interface TinypoolWorkerMessage<
  T extends 'port' | 'pool' = 'port' | 'pool',
> {
  __tinypool_worker_message__: true
  source: T
}

export interface StartupMessage {
  filename: string | null
  name: string
  port: MessagePort
  sharedBuffer: Int32Array
  useAtomics: boolean
}

export interface RequestMessage {
  taskId: number
  task: any
  filename: string
  name: string
}

export interface ReadyMessage {
  ready: true
}

export interface ResponseMessage {
  taskId: number
  result: any
  error: unknown | null
  usedMemory: number
}

export interface TinypoolPrivateData {
  workerId: number
}

export type TinypoolData = [TinypoolPrivateData, any] // [{ ... }, workerData]

// Internal symbol used to mark Transferable objects returned
// by the Tinypool.move() function
const kMovable = Symbol('Tinypool.kMovable')
export const kTransferable = Symbol.for('Tinypool.transferable')
export const kValue = Symbol.for('Tinypool.valueOf')
export const kQueueOptions = Symbol.for('Tinypool.queueOptions')

// True if the object implements the Transferable interface
export function isTransferable(value: any): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    kTransferable in value &&
    kValue in value
  )
}

// True if object implements Transferable and has been returned
// by the Tinypool.move() function
export function isMovable(value: any): boolean {
  return isTransferable(value) && value[kMovable] === true
}

export function markMovable(value: object): void {
  Object.defineProperty(value, kMovable, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: true,
  })
}

export interface Transferable {
  readonly [kTransferable]: object
  readonly [kValue]: object
}

export interface Task {
  readonly [kQueueOptions]: object | null
  cancel(): void
}

export interface TaskQueue {
  readonly size: number
  shift(): Task | null
  remove(task: Task): void
  push(task: Task): void
  cancel(): void
}

export function isTaskQueue(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'size' in value &&
    typeof value.shift === 'function' &&
    typeof value.remove === 'function' &&
    typeof value.push === 'function'
  )
}

export const kRequestCountField = 0
export const kResponseCountField = 1
export const kFieldCount = 2
