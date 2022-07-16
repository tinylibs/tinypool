import {
  Worker,
  MessageChannel,
  MessagePort,
  receiveMessageOnPort,
} from 'worker_threads'
import { once } from 'events'
import EventEmitterAsyncResource from './EventEmitterAsyncResource'
import { AsyncResource } from 'async_hooks'
import { fileURLToPath, URL } from 'url'
import { dirname, join, resolve } from 'path'
import { inspect, types } from 'util'
import assert from 'assert'
import { performance } from 'perf_hooks'
import { readFileSync } from 'fs'
import { amount as physicalCpuCount } from './physicalCpuCount'
import {
  ReadyMessage,
  RequestMessage,
  ResponseMessage,
  StartupMessage,
  kResponseCountField,
  kRequestCountField,
  kFieldCount,
  Transferable,
  Task,
  TaskQueue,
  kQueueOptions,
  isTransferable,
  markMovable,
  isMovable,
  kTransferable,
  kValue,
  TinypoolData,
} from './common'

declare global {
  namespace NodeJS {
    interface Process {
      __tinypool_state__: {
        isWorkerThread: boolean
        workerData: any
        workerId: number
      }
    }
  }
}

const cpuCount: number = physicalCpuCount

interface AbortSignalEventTargetAddOptions {
  once: boolean
}

interface AbortSignalEventTarget {
  addEventListener: (
    name: 'abort',
    listener: () => void,
    options?: AbortSignalEventTargetAddOptions
  ) => void
  removeEventListener: (name: 'abort', listener: () => void) => void
  aborted?: boolean
}
interface AbortSignalEventEmitter {
  off: (name: 'abort', listener: () => void) => void
  once: (name: 'abort', listener: () => void) => void
}
type AbortSignalAny = AbortSignalEventTarget | AbortSignalEventEmitter
function onabort(abortSignal: AbortSignalAny, listener: () => void) {
  if ('addEventListener' in abortSignal) {
    abortSignal.addEventListener('abort', listener, { once: true })
  } else {
    abortSignal.once('abort', listener)
  }
}
class AbortError extends Error {
  constructor() {
    super('The task has been aborted')
  }

  get name() {
    return 'AbortError'
  }
}

type ResourceLimits = Worker extends {
  resourceLimits?: infer T
}
  ? T
  : {}
type EnvSpecifier = typeof Worker extends {
  new (filename: never, options?: { env: infer T }): Worker
}
  ? T
  : never

class ArrayTaskQueue implements TaskQueue {
  tasks: Task[] = []

  get size() {
    return this.tasks.length
  }

  shift(): Task | null {
    return this.tasks.shift() as Task
  }

  push(task: Task): void {
    this.tasks.push(task)
  }

  remove(task: Task): void {
    const index = this.tasks.indexOf(task)
    assert.notStrictEqual(index, -1)
    this.tasks.splice(index, 1)
  }
}

interface Options {
  filename?: string | null
  name?: string
  minThreads?: number
  maxThreads?: number
  idleTimeout?: number
  maxQueue?: number | 'auto'
  concurrentTasksPerWorker?: number
  useAtomics?: boolean
  resourceLimits?: ResourceLimits
  argv?: string[]
  execArgv?: string[]
  env?: EnvSpecifier
  workerData?: any
  taskQueue?: TaskQueue
  trackUnmanagedFds?: boolean
  isolateWorkers?: boolean
}

interface FilledOptions extends Options {
  filename: string | null
  name: string
  minThreads: number
  maxThreads: number
  idleTimeout: number
  maxQueue: number
  concurrentTasksPerWorker: number
  useAtomics: boolean
  taskQueue: TaskQueue
}

const kDefaultOptions: FilledOptions = {
  filename: null,
  name: 'default',
  minThreads: Math.max(cpuCount / 2, 1),
  maxThreads: cpuCount,
  idleTimeout: 0,
  maxQueue: Infinity,
  concurrentTasksPerWorker: 1,
  useAtomics: true,
  taskQueue: new ArrayTaskQueue(),
  trackUnmanagedFds: true,
}

interface RunOptions {
  transferList?: TransferList
  filename?: string | null
  signal?: AbortSignalAny | null
  name?: string | null
}

interface FilledRunOptions extends RunOptions {
  transferList: TransferList | never
  filename: string | null
  signal: AbortSignalAny | null
  name: string | null
}

const kDefaultRunOptions: FilledRunOptions = {
  transferList: undefined,
  filename: null,
  signal: null,
  name: null,
}

class DirectlyTransferable implements Transferable {
  #value: object
  constructor(value: object) {
    this.#value = value
  }

  get [kTransferable](): object {
    return this.#value
  }

  get [kValue](): object {
    return this.#value
  }
}

class ArrayBufferViewTransferable implements Transferable {
  #view: ArrayBufferView
  constructor(view: ArrayBufferView) {
    this.#view = view
  }

  get [kTransferable](): object {
    return this.#view.buffer
  }

  get [kValue](): object {
    return this.#view
  }
}

let taskIdCounter = 0

type TaskCallback = (err: Error, result: any) => void
// Grab the type of `transferList` off `MessagePort`. At the time of writing,
// only ArrayBuffer and MessagePort are valid, but let's avoid having to update
// our types here every time Node.js adds support for more objects.
type TransferList = MessagePort extends {
  postMessage(value: any, transferList: infer T): any
}
  ? T
  : never
type TransferListItem = TransferList extends (infer T)[] ? T : never

function maybeFileURLToPath(filename: string): string {
  return filename.startsWith('file:')
    ? fileURLToPath(new URL(filename))
    : filename
}

// Extend AsyncResource so that async relations between posting a task and
// receiving its result are visible to diagnostic tools.
class TaskInfo extends AsyncResource implements Task {
  callback: TaskCallback
  task: any
  transferList: TransferList
  filename: string
  name: string
  taskId: number
  abortSignal: AbortSignalAny | null
  abortListener: (() => void) | null = null
  workerInfo: WorkerInfo | null = null
  created: number
  started: number

  constructor(
    task: any,
    transferList: TransferList,
    filename: string,
    name: string,
    callback: TaskCallback,
    abortSignal: AbortSignalAny | null,
    triggerAsyncId: number
  ) {
    super('Tinypool.Task', { requireManualDestroy: true, triggerAsyncId })
    this.callback = callback
    this.task = task
    this.transferList = transferList

    // If the task is a Transferable returned by
    // Tinypool.move(), then add it to the transferList
    // automatically
    if (isMovable(task)) {
      // This condition should never be hit but typescript
      // complains if we dont do the check.
      /* istanbul ignore if */
      if (this.transferList == null) {
        this.transferList = []
      }
      this.transferList = this.transferList.concat(task[kTransferable])
      this.task = task[kValue]
    }

    this.filename = filename
    this.name = name
    this.taskId = taskIdCounter++
    this.abortSignal = abortSignal
    this.created = performance.now()
    this.started = 0
  }

  releaseTask(): any {
    const ret = this.task
    this.task = null
    return ret
  }

  done(err: unknown | null, result?: any): void {
    this.emitDestroy() // `TaskInfo`s are used only once.
    this.runInAsyncScope(this.callback, null, err, result)
    // If an abort signal was used, remove the listener from it when
    // done to make sure we do not accidentally leak.
    if (this.abortSignal && this.abortListener) {
      if ('removeEventListener' in this.abortSignal && this.abortListener) {
        this.abortSignal.removeEventListener('abort', this.abortListener)
      } else {
        ;(this.abortSignal as AbortSignalEventEmitter).off(
          'abort',
          this.abortListener
        )
      }
    }
  }

  get [kQueueOptions](): object | null {
    return kQueueOptions in this.task ? this.task[kQueueOptions] : null
  }
}

abstract class AsynchronouslyCreatedResource {
  onreadyListeners: (() => void)[] | null = []

  markAsReady(): void {
    const listeners = this.onreadyListeners
    assert(listeners !== null)
    this.onreadyListeners = null
    for (const listener of listeners) {
      listener()
    }
  }

  isReady(): boolean {
    return this.onreadyListeners === null
  }

  onReady(fn: () => void) {
    if (this.onreadyListeners === null) {
      fn() // Zalgo is okay here.
      return
    }
    this.onreadyListeners.push(fn)
  }

  abstract currentUsage(): number
}

class AsynchronouslyCreatedResourcePool<
  T extends AsynchronouslyCreatedResource
> {
  pendingItems = new Set<T>()
  readyItems = new Set<T>()
  maximumUsage: number
  onAvailableListeners: ((item: T) => void)[]

  constructor(maximumUsage: number) {
    this.maximumUsage = maximumUsage
    this.onAvailableListeners = []
  }

  add(item: T) {
    this.pendingItems.add(item)
    item.onReady(() => {
      /* istanbul ignore else */
      if (this.pendingItems.has(item)) {
        this.pendingItems.delete(item)
        this.readyItems.add(item)
        this.maybeAvailable(item)
      }
    })
  }

  delete(item: T) {
    this.pendingItems.delete(item)
    this.readyItems.delete(item)
  }

  findAvailable(): T | null {
    let minUsage = this.maximumUsage
    let candidate = null
    for (const item of this.readyItems) {
      const usage = item.currentUsage()
      if (usage === 0) return item
      if (usage < minUsage) {
        candidate = item
        minUsage = usage
      }
    }
    return candidate
  }

  *[Symbol.iterator]() {
    yield* this.pendingItems
    yield* this.readyItems
  }

  get size() {
    return this.pendingItems.size + this.readyItems.size
  }

  maybeAvailable(item: T) {
    /* istanbul ignore else */
    if (item.currentUsage() < this.maximumUsage) {
      for (const listener of this.onAvailableListeners) {
        listener(item)
      }
    }
  }

  onAvailable(fn: (item: T) => void) {
    this.onAvailableListeners.push(fn)
  }
}

type ResponseCallback = (response: ResponseMessage) => void

const Errors = {
  ThreadTermination: () => new Error('Terminating worker thread'),
  FilenameNotProvided: () =>
    new Error('filename must be provided to run() or in options object'),
  TaskQueueAtLimit: () => new Error('Task queue is at limit'),
  NoTaskQueueAvailable: () =>
    new Error('No task queue available and all Workers are busy'),
}

class WorkerInfo extends AsynchronouslyCreatedResource {
  worker: Worker
  workerId: number
  freeWorkerId: () => void
  taskInfos: Map<number, TaskInfo>
  idleTimeout: NodeJS.Timeout | null = null // eslint-disable-line no-undef
  port: MessagePort
  sharedBuffer: Int32Array
  lastSeenResponseCount: number = 0
  onMessage: ResponseCallback

  constructor(
    worker: Worker,
    port: MessagePort,
    workerId: number,
    freeWorkerId: () => void,
    onMessage: ResponseCallback
  ) {
    super()
    this.worker = worker
    this.workerId = workerId
    this.freeWorkerId = freeWorkerId
    this.port = port
    this.port.on('message', (message: ResponseMessage) =>
      this._handleResponse(message)
    )
    this.onMessage = onMessage
    this.taskInfos = new Map()
    this.sharedBuffer = new Int32Array(
      new SharedArrayBuffer(kFieldCount * Int32Array.BYTES_PER_ELEMENT)
    )
  }

  destroy(): void {
    this.worker.terminate()
    this.port.close()
    this.freeWorkerId()
    this.clearIdleTimeout()
    for (const taskInfo of this.taskInfos.values()) {
      taskInfo.done(Errors.ThreadTermination())
    }
    this.taskInfos.clear()
  }

  clearIdleTimeout(): void {
    if (this.idleTimeout !== null) {
      clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
  }

  ref(): WorkerInfo {
    this.port.ref()
    return this
  }

  unref(): WorkerInfo {
    // Note: Do not call ref()/unref() on the Worker itself since that may cause
    // a hard crash, see https://github.com/nodejs/node/pull/33394.
    this.port.unref()
    return this
  }

  _handleResponse(message: ResponseMessage): void {
    this.onMessage(message)

    if (this.taskInfos.size === 0) {
      // No more tasks running on this Worker means it should not keep the
      // process running.
      this.unref()
    }
  }

  postTask(taskInfo: TaskInfo) {
    assert(!this.taskInfos.has(taskInfo.taskId))
    const message: RequestMessage = {
      task: taskInfo.releaseTask(),
      taskId: taskInfo.taskId,
      filename: taskInfo.filename,
      name: taskInfo.name,
    }

    try {
      this.port.postMessage(message, taskInfo.transferList)
    } catch (err) {
      // This would mostly happen if e.g. message contains unserializable data
      // or transferList is invalid.
      taskInfo.done(err)
      return
    }

    taskInfo.workerInfo = this
    this.taskInfos.set(taskInfo.taskId, taskInfo)
    this.ref()
    this.clearIdleTimeout()

    // Inform the worker that there are new messages posted, and wake it up
    // if it is waiting for one.
    Atomics.add(this.sharedBuffer, kRequestCountField, 1)
    Atomics.notify(this.sharedBuffer, kRequestCountField, 1)
  }

  processPendingMessages() {
    // If we *know* that there are more messages than we have received using
    // 'message' events yet, then try to load and handle them synchronously,
    // without the need to wait for more expensive events on the event loop.
    // This would usually break async tracking, but in our case, we already have
    // the extra TaskInfo/AsyncResource layer that rectifies that situation.
    const actualResponseCount = Atomics.load(
      this.sharedBuffer,
      kResponseCountField
    )
    if (actualResponseCount !== this.lastSeenResponseCount) {
      this.lastSeenResponseCount = actualResponseCount

      let entry
      while ((entry = receiveMessageOnPort(this.port)) !== undefined) {
        this._handleResponse(entry.message)
      }
    }
  }

  isRunningAbortableTask(): boolean {
    // If there are abortable tasks, we are running one at most per Worker.
    if (this.taskInfos.size !== 1) return false
    // @ts-ignore
    const [[, task]] = this.taskInfos
    return task.abortSignal !== null
  }

  currentUsage(): number {
    if (this.isRunningAbortableTask()) return Infinity
    return this.taskInfos.size
  }
}

class ThreadPool {
  publicInterface: Tinypool
  workers: AsynchronouslyCreatedResourcePool<WorkerInfo>
  workerIds: Map<number, boolean> // Map<workerId, isIdAvailable>
  options: FilledOptions
  taskQueue: TaskQueue
  skipQueue: TaskInfo[] = []
  completed: number = 0
  start: number = performance.now()
  inProcessPendingMessages: boolean = false
  startingUp: boolean = false
  workerFailsDuringBootstrap: boolean = false

  constructor(publicInterface: Tinypool, options: Options) {
    this.publicInterface = publicInterface
    this.taskQueue = options.taskQueue || new ArrayTaskQueue()

    const filename = options.filename
      ? maybeFileURLToPath(options.filename)
      : null
    this.options = { ...kDefaultOptions, ...options, filename, maxQueue: 0 }
    // The >= and <= could be > and < but this way we get 100 % coverage 🙃
    if (
      options.maxThreads !== undefined &&
      this.options.minThreads >= options.maxThreads
    ) {
      this.options.minThreads = options.maxThreads
    }
    if (
      options.minThreads !== undefined &&
      this.options.maxThreads <= options.minThreads
    ) {
      this.options.maxThreads = options.minThreads
    }
    if (options.maxQueue === 'auto') {
      this.options.maxQueue = this.options.maxThreads ** 2
    } else {
      this.options.maxQueue = options.maxQueue ?? kDefaultOptions.maxQueue
    }

    this.workerIds = new Map(
      new Array(options.maxThreads).fill(0).map((_, i) => [i + 1, true])
    )

    this.workers = new AsynchronouslyCreatedResourcePool<WorkerInfo>(
      this.options.concurrentTasksPerWorker
    )
    this.workers.onAvailable((w: WorkerInfo) => this._onWorkerAvailable(w))

    this.startingUp = true
    this._ensureMinimumWorkers()
    this.startingUp = false
  }

  _ensureMaximumWorkers(): void {
    while (this.workers.size < this.options.maxThreads) {
      this._addNewWorker()
    }
  }

  _ensureMinimumWorkers(): void {
    while (this.workers.size < this.options.minThreads) {
      this._addNewWorker()
    }
  }

  _addNewWorker(): void {
    const pool = this
    const workerIds = this.workerIds
    const __dirname = dirname(fileURLToPath(import.meta.url))

    let workerId: number

    workerIds.forEach((isIdAvailable, _workerId) => {
      if (isIdAvailable && !workerId) {
        workerId = _workerId
        workerIds.set(_workerId, false)
      }
    })
    const tinypoolPrivateData = { workerId: workerId! }

    const worker = new Worker(resolve(__dirname, './worker.js'), {
      env: this.options.env,
      argv: this.options.argv,
      execArgv: this.options.execArgv,
      resourceLimits: this.options.resourceLimits,
      workerData: [
        tinypoolPrivateData,
        this.options.workerData,
      ] as TinypoolData,
      trackUnmanagedFds: this.options.trackUnmanagedFds,
    })

    const onMessage = (message: ResponseMessage) => {
      const { taskId, result } = message
      // In case of success: Call the callback that was passed to `runTask`,
      // remove the `TaskInfo` associated with the Worker, which marks it as
      // free again.
      const taskInfo = workerInfo.taskInfos.get(taskId)
      workerInfo.taskInfos.delete(taskId)

      if (!this.options.isolateWorkers) pool.workers.maybeAvailable(workerInfo)

      /* istanbul ignore if */
      if (taskInfo === undefined) {
        const err = new Error(
          `Unexpected message from Worker: ${inspect(message)}`
        )
        pool.publicInterface.emit('error', err)
      } else {
        taskInfo.done(message.error, result)
      }

      pool._processPendingMessages()
    }

    const { port1, port2 } = new MessageChannel()
    const workerInfo = new WorkerInfo(
      worker,
      port1,
      workerId!,
      () => workerIds.set(workerId, true),
      onMessage
    )
    if (this.startingUp) {
      // There is no point in waiting for the initial set of Workers to indicate
      // that they are ready, we just mark them as such from the start.
      workerInfo.markAsReady()
    }

    const message: StartupMessage = {
      filename: this.options.filename,
      name: this.options.name,
      port: port2,
      sharedBuffer: workerInfo.sharedBuffer,
      useAtomics: this.options.useAtomics,
    }

    worker.postMessage(message, [port2])

    worker.on('message', (message: ReadyMessage) => {
      if (message.ready === true) {
        if (workerInfo.currentUsage() === 0) {
          workerInfo.unref()
        }

        if (!workerInfo.isReady()) {
          workerInfo.markAsReady()
        }
        return
      }

      worker.emit(
        'error',
        new Error(`Unexpected message on Worker: ${inspect(message)}`)
      )
    })

    worker.on('error', (err: Error) => {
      // Work around the bug in https://github.com/nodejs/node/pull/33394
      worker.ref = () => {}

      // In case of an uncaught exception: Call the callback that was passed to
      // `postTask` with the error, or emit an 'error' event if there is none.
      const taskInfos = [...workerInfo.taskInfos.values()]
      workerInfo.taskInfos.clear()

      // Remove the worker from the list and potentially start a new Worker to
      // replace the current one.
      this._removeWorker(workerInfo)

      if (workerInfo.isReady() && !this.workerFailsDuringBootstrap) {
        this._ensureMinimumWorkers()
      } else {
        // Do not start new workers over and over if they already fail during
        // bootstrap, there's no point.
        this.workerFailsDuringBootstrap = true
      }

      if (taskInfos.length > 0) {
        for (const taskInfo of taskInfos) {
          taskInfo.done(err, null)
        }
      } else {
        this.publicInterface.emit('error', err)
      }
    })

    worker.unref()
    port1.on('close', () => {
      // The port is only closed if the Worker stops for some reason, but we
      // always .unref() the Worker itself. We want to receive e.g. 'error'
      // events on it, so we ref it once we know it's going to exit anyway.
      worker.ref()
    })

    this.workers.add(workerInfo)
  }

  _processPendingMessages() {
    if (this.inProcessPendingMessages || !this.options.useAtomics) {
      return
    }

    this.inProcessPendingMessages = true
    try {
      for (const workerInfo of this.workers) {
        workerInfo.processPendingMessages()
      }
    } finally {
      this.inProcessPendingMessages = false
    }
  }

  _removeWorker(workerInfo: WorkerInfo): void {
    workerInfo.destroy()

    this.workers.delete(workerInfo)
  }

  _onWorkerAvailable(workerInfo: WorkerInfo): void {
    while (
      (this.taskQueue.size > 0 || this.skipQueue.length > 0) &&
      workerInfo.currentUsage() < this.options.concurrentTasksPerWorker
    ) {
      // The skipQueue will have tasks that we previously shifted off
      // the task queue but had to skip over... we have to make sure
      // we drain that before we drain the taskQueue.
      const taskInfo =
        this.skipQueue.shift() || (this.taskQueue.shift() as TaskInfo)
      // If the task has an abortSignal and the worker has any other
      // tasks, we cannot distribute the task to it. Skip for now.
      if (taskInfo.abortSignal && workerInfo.taskInfos.size > 0) {
        this.skipQueue.push(taskInfo)
        break
      }
      const now = performance.now()
      taskInfo.started = now
      workerInfo.postTask(taskInfo)
      this._maybeDrain()
      return
    }

    if (
      workerInfo.taskInfos.size === 0 &&
      this.workers.size > this.options.minThreads
    ) {
      workerInfo.idleTimeout = setTimeout(() => {
        assert.strictEqual(workerInfo.taskInfos.size, 0)
        if (this.workers.size > this.options.minThreads) {
          this._removeWorker(workerInfo)
        }
      }, this.options.idleTimeout).unref()
    }
  }

  runTask(task: any, options: RunOptions): Promise<any> {
    let { filename, name } = options
    const { transferList = [], signal = null } = options
    if (filename == null) {
      filename = this.options.filename
    }
    if (name == null) {
      name = this.options.name
    }
    if (typeof filename !== 'string') {
      return Promise.reject(Errors.FilenameNotProvided())
    }
    filename = maybeFileURLToPath(filename)

    let resolve: (result: any) => void
    let reject: (err: Error) => void
    // eslint-disable-next-line
    const ret = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    const taskInfo = new TaskInfo(
      task,
      transferList,
      filename,
      name,
      (err: Error | null, result: any) => {
        this.completed++
        if (err !== null) {
          reject(err)
        } else {
          resolve(result)
        }

        // When `isolateWorkers` is enabled, remove the worker after task is finished
        if (this.options.isolateWorkers && taskInfo.workerInfo) {
          this._removeWorker(taskInfo.workerInfo)
          this._ensureMinimumWorkers()
        }
      },
      signal,
      this.publicInterface.asyncResource.asyncId()
    )

    if (signal !== null) {
      // If the AbortSignal has an aborted property and it's truthy,
      // reject immediately.
      if ((signal as AbortSignalEventTarget).aborted) {
        return Promise.reject(new AbortError())
      }
      taskInfo.abortListener = () => {
        // Call reject() first to make sure we always reject with the AbortError
        // if the task is aborted, not with an Error from the possible
        // thread termination below.
        reject(new AbortError())

        if (taskInfo.workerInfo !== null) {
          // Already running: We cancel the Worker this is running on.
          this._removeWorker(taskInfo.workerInfo)
          this._ensureMinimumWorkers()
        } else {
          // Not yet running: Remove it from the queue.
          this.taskQueue.remove(taskInfo)
        }
      }
      onabort(signal, taskInfo.abortListener)
    }

    // If there is a task queue, there's no point in looking for an available
    // Worker thread. Add this task to the queue, if possible.
    if (this.taskQueue.size > 0) {
      const totalCapacity = this.options.maxQueue + this.pendingCapacity()
      if (this.taskQueue.size >= totalCapacity) {
        if (this.options.maxQueue === 0) {
          return Promise.reject(Errors.NoTaskQueueAvailable())
        } else {
          return Promise.reject(Errors.TaskQueueAtLimit())
        }
      } else {
        if (this.workers.size < this.options.maxThreads) {
          this._addNewWorker()
        }
        this.taskQueue.push(taskInfo)
      }

      return ret
    }

    // Look for a Worker with a minimum number of tasks it is currently running.
    let workerInfo: WorkerInfo | null = this.workers.findAvailable()

    // If we want the ability to abort this task, use only workers that have
    // no running tasks.
    if (workerInfo !== null && workerInfo.currentUsage() > 0 && signal) {
      workerInfo = null
    }

    // If no Worker was found, or that Worker was handling another task in some
    // way, and we still have the ability to spawn new threads, do so.
    let waitingForNewWorker = false
    if (
      (workerInfo === null || workerInfo.currentUsage() > 0) &&
      this.workers.size < this.options.maxThreads
    ) {
      this._addNewWorker()
      waitingForNewWorker = true
    }

    // If no Worker is found, try to put the task into the queue.
    if (workerInfo === null) {
      if (this.options.maxQueue <= 0 && !waitingForNewWorker) {
        return Promise.reject(Errors.NoTaskQueueAvailable())
      } else {
        this.taskQueue.push(taskInfo)
      }

      return ret
    }

    const now = performance.now()
    taskInfo.started = now
    workerInfo.postTask(taskInfo)
    this._maybeDrain()

    return ret
  }

  pendingCapacity(): number {
    return (
      this.workers.pendingItems.size * this.options.concurrentTasksPerWorker
    )
  }

  _maybeDrain() {
    if (this.taskQueue.size === 0 && this.skipQueue.length === 0) {
      this.publicInterface.emit('drain')
    }
  }

  async destroy() {
    while (this.skipQueue.length > 0) {
      const taskInfo: TaskInfo = this.skipQueue.shift() as TaskInfo
      taskInfo.done(new Error('Terminating worker thread'))
    }
    while (this.taskQueue.size > 0) {
      const taskInfo: TaskInfo = this.taskQueue.shift() as TaskInfo
      taskInfo.done(new Error('Terminating worker thread'))
    }

    const exitEvents: Promise<any[]>[] = []
    while (this.workers.size > 0) {
      const [workerInfo] = this.workers
      // @ts-ignore
      exitEvents.push(once(workerInfo.worker, 'exit'))
      // @ts-ignore
      this._removeWorker(workerInfo)
    }

    await Promise.all(exitEvents)
  }
}

class Tinypool extends EventEmitterAsyncResource {
  #pool: ThreadPool

  constructor(options: Options = {}) {
    // convert fractional option values to int
    if (
      options.minThreads !== undefined &&
      options.minThreads > 0 &&
      options.minThreads < 1
    ) {
      options.minThreads = Math.max(
        1,
        Math.floor(options.minThreads * cpuCount)
      )
    }
    if (
      options.maxThreads !== undefined &&
      options.maxThreads > 0 &&
      options.maxThreads < 1
    ) {
      options.maxThreads = Math.max(
        1,
        Math.floor(options.maxThreads * cpuCount)
      )
    }

    super({ ...options, name: 'Tinypool' })

    if (
      options.minThreads !== undefined &&
      options.maxThreads !== undefined &&
      options.minThreads > options.maxThreads
    ) {
      throw new RangeError(
        'options.minThreads and options.maxThreads must not conflict'
      )
    }

    this.#pool = new ThreadPool(this, options)
  }

  run(task: any, options: RunOptions = kDefaultRunOptions) {
    const { transferList, filename, name, signal } = options

    return this.#pool.runTask(task, { transferList, filename, name, signal })
  }

  destroy() {
    return this.#pool.destroy()
  }

  get options(): FilledOptions {
    return this.#pool.options
  }

  get threads(): Worker[] {
    const ret: Worker[] = []
    for (const workerInfo of this.#pool.workers) {
      ret.push(workerInfo.worker)
    }
    return ret
  }

  get queueSize(): number {
    const pool = this.#pool
    return Math.max(pool.taskQueue.size - pool.pendingCapacity(), 0)
  }

  get completed(): number {
    return this.#pool.completed
  }

  get duration(): number {
    return performance.now() - this.#pool.start
  }

  static get isWorkerThread(): boolean {
    return process.__tinypool_state__?.isWorkerThread || false
  }

  static get workerData(): any {
    return process.__tinypool_state__?.workerData || undefined
  }

  static get version(): string {
    const { version } = JSON.parse(
      readFileSync(join(__dirname, '../package.json'), 'utf-8')
    ) as typeof import('../package.json')
    return version
  }

  static move(
    val:
      | Transferable
      | TransferListItem
      | ArrayBufferView
      | ArrayBuffer
      | MessagePort
  ) {
    if (val != null && typeof val === 'object' && typeof val !== 'function') {
      if (!isTransferable(val)) {
        if ((types as any).isArrayBufferView(val)) {
          val = new ArrayBufferViewTransferable(val as ArrayBufferView)
        } else {
          val = new DirectlyTransferable(val)
        }
      }
      markMovable(val)
    }
    return val
  }

  static get transferableSymbol() {
    return kTransferable
  }

  static get valueSymbol() {
    return kValue
  }

  static get queueOptionsSymbol() {
    return kQueueOptions
  }
}

const _workerId = process.__tinypool_state__?.workerId

export * from './common'
export { Tinypool, Options, _workerId as workerId }
export default Tinypool
