import { workerId } from '../../dist/esm/index.js'

export default async ({ slow }) => {
  if (slow) {
    await new Promise((res) => setTimeout(res, 100))
  }

  return workerId
}
