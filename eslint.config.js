import { readFileSync } from 'node:fs'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

const tsconfig = JSON.parse(readFileSync('./tsconfig.json', 'utf8'))

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: tsconfig.include,
  })),
  {
    files: tsconfig.include,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
  {
    plugins: { unicorn: eslintPluginUnicorn },
    rules: { 'unicorn/prefer-node-protocol': 'error' },
  },
  {
    // TODO: Must-have rules. Enable one-by-one
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      'no-constant-condition': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/ban-types': 'off',
    },
  },
  {
    // TODO: Nice-to-have rules
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
    },
  },
  { ignores: ['dist'] },
  eslintPluginPrettierRecommended,
])

/** @param config {import('eslint').Linter.FlatConfig} */
function defineConfig(config) {
  return config
}
