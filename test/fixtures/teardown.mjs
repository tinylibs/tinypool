import { setTimeout } from 'node:timers/promises'

let state = 0

/** @type {import("node:worker_threads").MessagePort } */
let port

export default function task(options) {
  port ||= options?.port
  state++

  return `Output of task #${state}`
}

export async function namedTeardown() {
  await setTimeout(50)

  port?.postMessage(`Teardown of task #${state}`)
}
