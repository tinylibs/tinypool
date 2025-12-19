export default async function run(task) {
  let resolve = () => {}
  const promise = new Promise((r) => (resolve = r))

  process.send('Child process started')

  process.on('message', (message) => {
    process.send({ received: message, response: 'Hello from worker' })
    resolve({ received: task, response: 'Hello from worker' })
  })

  return promise
}
