import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { TransferListItem } from 'node:worker_threads'
import type {
  TinypoolChannel,
  TinypoolWorker,
  TinypoolWorkerMessage,
} from '../common'

const __tinypool_worker_message__ = true
const SIGKILL_TIMEOUT = 1000

export default class ProcessWorker implements TinypoolWorker {
  name = 'ProcessWorker'
  runtime = 'bun_spawn'
  process!: import('bun').Subprocess
  threadId!: number
  port?: MessagePort
  channel?: TinypoolChannel
  waitForExit!: Promise<void>
  isTerminating = false
  resolveExit!: () => void
  private onError: ((error: Error) => void)[] = []
  private onMessage: ((data: TinypoolWorkerMessage) => void)[] = []
  private onExit: ((code: number | null) => void)[] = []

  initialize(options: Parameters<TinypoolWorker['initialize']>[0]) {
    this.process = Bun.spawn({
      cmd: [
        'bun',
        fileURLToPath(join(import.meta.url, '/../entry/process.js')),
        ...(options.argv || []),
      ],
      env: {
        ...Bun.env,
        ...options.env,
        TINYPOOL_WORKER_ID: options.workerData[0].workerId.toString(),
      },
      stdin: 'inherit', // No need for stdin pipe
      stdout: 'pipe', // Pipe stdout for logs
      stderr: 'pipe', // Pipe stderr for logs
      ipc: (message: TinypoolWorkerMessage) => {
        for (const handler of this.onMessage) {
          handler(message)
        }
      },
      onExit: (subprocess, exitCode, signalCode, error) => {
        if (error) {
          for (const handler of this.onError) {
            handler(error)
          }
        }

        for(const handler of this.onExit) {
          handler(exitCode);
        }
        this.onError = []
        this.onExit = []
      },
      serialization: 'json', // Ensure JSON serialization for IPC,
    })

    this.threadId = this.process.pid!

    // Set up exit promise
    this.waitForExit = new Promise((resolve) => {
      this.resolveExit = resolve
    })

    // Pipe stdout/stderr to main process for logs
    this.process.stdout?.pipeTo(
      new WritableStream({
        write(chunk) {
          process.stdout.write(chunk)
        },
      })
    )
    this.process.stderr?.pipeTo(
      new WritableStream({
        write(chunk) {
          process.stderr.write(chunk)
        },
      })
    )

    // Handle unexpected exit
    this.process.exited.then(() => {
      if (!this.isTerminating) {
        this.emit('error', new Error('Worker exited unexpectedly'))
      }
      this.resolveExit()
    })
  }

  async terminate() {
    this.isTerminating = true

    const sigkillTimeout = setTimeout(() => {
      this.process.kill('SIGKILL')
    }, SIGKILL_TIMEOUT)

    this.process.kill()
    await this.waitForExit

    await this.process.stdout.cancel()
    await this.process.stderr.cancel()
    this.port?.close()

    clearTimeout(sigkillTimeout)
    this.onMessage = []
  }

  setChannel(channel: TinypoolChannel) {
    this.channel = channel
    this.channel.onMessage((message: any) => {
      this.send(message)
    })
  }

  private send(message: Parameters<NonNullable<(typeof process)['send']>>[0]) {
    if (!this.isTerminating) {
      this.process.send(message)
    }
  }

  postMessage(message: any, transferListItem?: Readonly<TransferListItem[]>) {
    for (const item of transferListItem || []) {
      if (item instanceof MessagePort) {
        this.port = item
      }
    }

    if (this.port) {
      this.port.onmessage =  (portMessage) => {
        this.send(<TinypoolWorkerMessage<'port'>>{
          ...portMessage.data,
          source: 'port',
          __tinypool_worker_message__,
        })
      }
    }

    return this.send(<TinypoolWorkerMessage<'pool'>>{
      ...message,
      source: 'pool',
      __tinypool_worker_message__,
    })
  }

  private registerHandler(event: string, callback: (...args: any[]) => void, clean: boolean) {
    if (event === 'error') {
      const handler = (error: Error): void => {
        callback(error)
        if(clean) this.onError.splice(this.onError.indexOf(handler), 1)
      }
      this.onError.push(handler)
      return
    }

    if (event === 'message') {
      const handler = (data: TinypoolWorkerMessage) => {
        if (!data || !data.__tinypool_worker_message__) {
          this.channel?.postMessage(data)
          if(clean) this.onMessage.splice(this.onMessage.indexOf(handler), 1)
          return
        }

        if (data.source === 'pool') {
          callback(data)
        } else if (data.source === 'port') {
          this.port?.postMessage(data)
        }
        if(clean) this.onMessage.splice(this.onMessage.indexOf(handler), 1)
      }
      this.onMessage.push(handler)
      return;
    }

    if(event === 'exit') {
      const handler = (code: number | null) => {
        callback(code);
        if(clean) this.onExit.splice(this.onExit.indexOf(handler), 1);
      }
      this.onExit.push(handler)
      return;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.registerHandler(event, callback, false);
  }

  once(event: string, callback: (...args: any[]) => void) {
    this.registerHandler(event, callback, true);
  }

  emit(event: string, ...data: any[]) {
    if (event === 'error') {
      for(const handler of this.onError) {
        handler(data[0]);
      }
    }

    if(event === 'message') {
      for(const handler of this.onMessage) {
        handler(data[0]);   
      }
    }
  }

  ref() {
    // Bun Subprocess supports ref/unref
    this.process.ref()
  }

  unref() {
    // Bun Subprocess supports ref/unref
    this.process.unref()
  }
}
