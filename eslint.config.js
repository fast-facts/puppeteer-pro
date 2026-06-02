import tseslint from 'typescript-eslint';
import config from 'eslint-config-final';

export default tseslint.config(
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
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);