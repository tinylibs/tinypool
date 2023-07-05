# Tinypool - the node.js worker pool 🧵

> Piscina: A fast, efficient Node.js Worker Thread Pool implementation

Tinypool is a fork of piscina. What we try to achieve in this library, is to eliminate some dependencies and features that our target users don't need (currently, our main user will be Vitest). Tinypool's install size (38KB) can then be smaller than Piscina's install size (6MB). If you need features like [utilization](https://github.com/piscinajs/piscina#property-utilization-readonly) or [NAPI](https://github.com/piscinajs/piscina#thread-priority-on-linux-systems), [Piscina](https://github.com/piscinajs/piscina) is a better choice for you. We think that Piscina is an amazing library, and we may try to upstream some of the dependencies optimization in this fork.

- ✅ Smaller install size, 38KB
- ✅ Minimal
- ✅ No dependencies
- ✅ Physical cores instead of Logical cores with [physical-cpu-count](https://www.npmjs.com/package/physical-cpu-count)
- ❌ No utilization
- ❌ No NAPI

- Written in TypeScript, and ESM support only. For Node.js 14.x and higher.

_In case you need more tiny libraries like tinypool or tinyspy, please consider submitting an [RFC](https://github.com/tinylibs/rfcs)_

## Example

In `main.js`:

```js
import Tinypool from 'tinypool'

const pool = new Tinypool({
  filename: new URL('./worker.js', import.meta.url).href,
})

const result = await pool.run({ a: 4, b: 6 })
console.log(result) // Prints 10
```

In `worker.js`:

```js
export default ({ a, b }) => {
  return a + b
}
```

## API

We have a similar API to Piscina, so for more information, you can read Piscina's detailed [documentation](https://github.com/piscinajs/piscina#piscina---the-nodejs-worker-pool) and apply the same techniques here.

### Tinypool specific APIs

#### Pool constructor options

- `isolateWorkers`: Disabled by default. Always starts with a fresh worker when running tasks to isolate the environment.
- `terminateTimeout`: Disabled by default. If terminating a worker takes `terminateTimeout` amount of milliseconds to execute, an error is raised.
- `maxMemoryLimitBeforeRecycle`: Disabled by default. When defined, the worker's heap memory usage is compared against this value after task has been finished. If the current memory usage exceeds this limit, worker is terminated and a new one is started to take its place. This option is useful when your tasks leak memory and you don't want to enable `isolateWorkers` option.

#### Pool methods

- `cancelPendingTasks()`: Gracefully cancels all pending tasks without stopping or interfering with on-going tasks. This method is useful when your tasks may have side effects and should not be terminated forcefully during task execution. If your tasks don't have any side effects you may want to use [`{ signal }`](https://github.com/piscinajs/piscina#cancelable-tasks) option for forcefully terminating all tasks, including the on-going ones, instead.
- `recycleWorkers()`: Waits for all current tasks to finish and re-creates all workers. Can be used to force isolation imperatively even when `isolateWorkers` is disabled.

#### Exports

- `workerId`: Each worker now has an id ( <= `maxThreads`) that can be imported from `tinypool` in the worker itself (or `process.__tinypool_state__.workerId`).

## Authors

| <a href="https://github.com/Aslemammad"> <img width='150' src="https://avatars.githubusercontent.com/u/37929992?v=4" /><br> Mohammad Bagher </a> |
| ------------------------------------------------------------------------------------------------------------------------------------------------ |

## Sponsors

Your sponsorship can make a huge difference in continuing our work in open source!

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/aslemammad/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/aslemammad/static/sponsors.svg'/>
  </a>
</p>

## Credits

[The Vitest team](https://vitest.dev/) for giving me the chance of creating and maintaing this project for vitest.

[Piscina](https://github.com/piscinajs/piscina), because Tinypool is not more than a friendly fork of piscina.
