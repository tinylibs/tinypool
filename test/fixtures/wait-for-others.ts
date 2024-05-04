import { threadId } from 'worker_threads'

export default async function ([i32array, n]: [
  array: Int32Array,
  num: number
]) {
  Atomics.add(i32array, 0, 1)
  Atomics.notify(i32array, 0, Infinity)
  let lastSeenValue: number
  while ((lastSeenValue = Atomics.load(i32array, 0)) < n) {
    Atomics.wait(i32array, 0, lastSeenValue)
  }
  return threadId
}
