# Tinypool - the minimal node.js worker pool 🧵

> Piscina: A fast, efficient Node.js Worker Thread Pool implementation

Tinypool is no more than a fork of piscina, what we try to acheive in this library, is to eliminate some dependencies and extra features of piscina that we're less likely to use them in our projects. 
That's why Tinypool's install size (24KB) is so smaller than Piscina's install size (6MB).
Therefore, if you need features like [utilization](https://github.com/piscinajs/piscina#property-utilization-readonly) or [NAPI](https://github.com/piscinajs/piscina#thread-priority-on-linux-systems), [Piscina](https://github.com/piscinajs/piscina) is a better choice for you.

* ✅ Smaller install size, 24KB 
* ✅ Minimal
* ✅ No dependencies 
* ❌ No utilization
* ❌ No NAPI



* Written in TypeScript, and ESM support only. For Node.js 14.x and higher.

## Example

In `main.js`:

```js
import path from 'path'
import Tinypool from 'tinypool'

const pool = new Tinypool({
  filename: new URL('./worker.js', import.meta.url).href
});

(async function() {
  const result = await pool.run({ a: 4, b: 6 });
  console.log(result);  // Prints 10
})();
```

In `worker.js`:

```js
export default ({ a, b }) => {
  return a + b;
};
```
## API

We have a similar API to Piscina, so for more information, you can read Piscina's detailed [documentation](https://github.com/piscinajs/piscina#piscina---the-nodejs-worker-pool) and apply the same techniques here.

## Credits

[The Vitest team](https://vitest.dev/) for giving me the chance of creating and maintaing this project for vitest.
