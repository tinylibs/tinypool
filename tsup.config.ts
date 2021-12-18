import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: ['src/index.ts', 'src/worker.ts'],
  splitting: true,
  legacyOutput: true,
  outDir: 'dist',
  format: ['esm'],
  tsconfig: './tsconfig.json',
  target: 'es2020',
  clean: true,
  dts: true,
})
