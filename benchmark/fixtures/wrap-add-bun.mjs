import add from './add.mjs'

self.onmessage = (event) => {
  postMessage(add(event.data))
}
