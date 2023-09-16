import { defineConfig } from 'tsup'

export default defineConfig((mode) => ({
  entryPoints: ['src/index.ts', 'src/entry/*.ts'],
  splitting: true,
  legacyOutput: true,
  outDir: 'dist',
  format: ['esm'],
  tsconfig: './tsconfig.json',
  target: 'es2020',
  clean: true,
  dts: mode.watch ? false : true,
}))
