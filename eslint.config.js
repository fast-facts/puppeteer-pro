const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "dist/",
      "eslint.config.js"
    ],
  },
  {
    files: ["**/*.ts"],

    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: [
          "tsconfig.json",
          "tsconfig.spec.json",
        ],
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
    },

    rules: {
      "arrow-parens": ["error", "as-needed"],
      "comma-dangle": ["error", {
        "arrays": "always-multiline"
      }],
      eqeqeq: ["error", "always", {
        null: "ignore",
      }],
      "no-return-await": "error",
      "prefer-arrow-callback": "error",
      "quotes": ["error", "single", {
        "avoidEscape": true
      }],
      "quote-props": ["error", "as-needed"],
      semi: ["error", "always"],

      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": ["error",
        {
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }]
    },
  }
);