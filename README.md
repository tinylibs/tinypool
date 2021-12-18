# Tinypool - the node.js worker pool 🧵

> Piscina: A fast, efficient Node.js Worker Thread Pool implementation

Tinypool is a fork of piscina. What we try to achieve in this library, is to eliminate some dependencies and features that our target users don't need (currently, our main user will be Vitest). Tinypool's install size (24KB) can then be smaller than Piscina's install size (6MB). If you need features like [utilization](https://github.com/piscinajs/piscina#property-utilization-readonly) or [NAPI](https://github.com/piscinajs/piscina#thread-priority-on-linux-systems), [Piscina](https://github.com/piscinajs/piscina) is a better choice for you. We think that Piscina is an amazing library, and we may try to upstream some of the dependencies optimization in this fork.

- ✅ Smaller install size, 24KB
- ✅ Minimal
- ✅ No dependencies
- ❌ No utilization
- ❌ No NAPI

- Written in TypeScript, and ESM support only. For Node.js 14.x and higher.

## Example

In `main.js`:

```js
import path from 'path'
import Tinypool from 'tinypool'

const pool = new Tinypool({
  filename: new URL('./worker.js', import.meta.url).href,
})

;(async function () {
  const result = await pool.run({ a: 4, b: 6 })
  console.log(result) // Prints 10
})()
```

In `worker.js`:

```js
export default ({ a, b }) => {
  return a + b
}
```

## API

We have a similar API to Piscina, so for more information, you can read Piscina's detailed [documentation](https://github.com/piscinajs/piscina#piscina---the-nodejs-worker-pool) and apply the same techniques here.

## Credits

[The Vitest team](https://vitest.dev/) for giving me the chance of creating and maintaing this project for vitest.

[Piscina](https://github.com/piscinajs/piscina), because Tinypool is not more than a friendly fork of piscina.
