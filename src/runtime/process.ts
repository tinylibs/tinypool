import type { TinypoolWorker } from 'src/common';
import { isBun } from 'src/utils'
import BunProcessWorker from './bun-process-worker';
import ProcessWorker from './process-worker';

interface TinypoolWorkerConstructor {
  new(): TinypoolWorker;
}

const p: TinypoolWorkerConstructor = isBun ? BunProcessWorker : ProcessWorker

export default p;