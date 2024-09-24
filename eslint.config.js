const tseslint = require('typescript-eslint');
const config = require('eslint-config-final');

module.exports = tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      'dist/',
      'eslint.config.js'
    ],
  },
  {
    files: ['**/*.ts'],

    extends: [
      ...config.typescript,
    ],

    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',

      parserOptions: {
        project: [
          'tsconfig.json',
          'tsconfig.spec.json',
        ],
      }
    },
  }
);