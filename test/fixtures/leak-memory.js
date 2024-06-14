/** Enable to see memory leak logging */
const logOutput = false

// eslint-disable-next-line prefer-const -- intentional
export let leaks = []

/**
 * Leak some memory to test memory limit usage.
 * The argument `bytes` is not 100% accurate of the leaked bytes but good enough.
 */
export default function run(bytes) {
  const before = process.memoryUsage().heapUsed

  for (const _ of Array(bytes).fill()) {
    leaks.push(new SharedArrayBuffer(1024))
  }
  const after = process.memoryUsage().heapUsed
  const diff = after - before

  if (logOutput) {
    console.log(`Leaked: ${diff}. Heap used: ${process.memoryUsage().heapUsed}`)
  }
}
