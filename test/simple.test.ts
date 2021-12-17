import { dirname, resolve } from 'path';
import Tinypool from 'tinypool'
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('basic test', async () => {
  const worker = new Tinypool({
    filename: resolve(__dirname, 'fixtures/simple-isworkerthread.js')
  });
  const result = await worker.run(null);
  expect(result).toBe('done');
});
