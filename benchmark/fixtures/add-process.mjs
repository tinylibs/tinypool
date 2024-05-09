import add from './add.mjs'

process.on('message', (message) => {
  process.send(add(message))
})
