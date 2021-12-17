'use strict';

import { promisify } from 'util'
const sleep = promisify(setTimeout);

// eslint-disable-next-line no-eval
function handler (code) { return eval(code); }

async function load () {
  await sleep(100);
  return handler;
}

export default load();
