const { default: love } = require('eslint-config-love')
const prettier = require('eslint-config-prettier')
const prettierPlugin = require('eslint-plugin-prettier')

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ...love,
    files: ['src/**/*.ts'],
    plugins: {
      ...love.plugins,
      prettier: prettierPlugin,
    },
    rules: {
      ...love.rules,
      ...prettier.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1, 2],
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
        },
      ],
    },
  },
]
