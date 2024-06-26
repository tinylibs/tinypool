import { threadId } from 'node:worker_threads'

export default function ([i32array, n]) {
  Atomics.add(i32array, 0, 1)
  Atomics.notify(i32array, 0, Infinity)
  let lastSeenValue
  while ((lastSeenValue = Atomics.load(i32array, 0)) < n) {
    Atomics.wait(i32array, 0, lastSeenValue)
  }
  return threadId
}
