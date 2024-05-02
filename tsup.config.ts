import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/entry/*.ts'],
  splitting: true,
  outDir: 'dist',
  format: ['esm'],
  tsconfig: './tsconfig.json',
  target: 'es2020',
  clean: true,
  dts: true,
})
