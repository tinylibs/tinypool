import type { TinypoolWorker } from 'src/common';
import BunProcessWorker from './bun-process-worker';
import ProcessWorker from './process-worker';

interface TinypoolWorkerConstructor {
  new(): TinypoolWorker;
}

let p: TinypoolWorkerConstructor;

if(process.versions.bun) {
  p = BunProcessWorker
} else {
  p = ProcessWorker;
}

export default p;