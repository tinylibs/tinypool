import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: ['src/index.ts', 'src/worker.ts'],
  esbuildOptions: (options) => {
    options.banner = {
      // js: "import { createRequire as topLevelCreateRequire } from 'module';\n const require = topLevelCreateRequire(import.meta.url);"
      // js: "const require = import"
    }
  },
  splitting: false,
  legacyOutput: true,
  outDir: 'dist',
  format: ['esm'],
  tsconfig: './tsconfig.json',
  target: 'es2020',
  clean: true,
  dts: true,
})
