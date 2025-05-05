// only for tsdown build, excluded from the final tgz
declare namespace NodeJS {
  interface Process {
    __tinypool_state__: {
      isTinypoolWorker: boolean
      isWorkerThread?: boolean
      isChildProcess?: boolean
      workerData: any
      workerId: number
    }
  }
}
