import Tinypool from '../../dist/esm/index'
import { resolve } from 'path'

const pool = new Tinypool({
  filename: resolve(__dirname, 'eval.js'),
  maxThreads: 1,
})

pool.run('console.log("A"); console.log("B");')
