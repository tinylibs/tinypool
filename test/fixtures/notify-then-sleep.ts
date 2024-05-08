export default function (i32array: Int32Array) {
  Atomics.store(i32array, 0, 1)
  Atomics.notify(i32array, 0, Infinity)
  Atomics.wait(i32array, 0, 1)
}
