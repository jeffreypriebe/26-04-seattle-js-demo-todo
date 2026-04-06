const { default: love } = require('eslint-config-love')
const prettier = require('eslint-config-prettier')
const prettierPlugin = require('eslint-plugin-prettier')

// Downgrade all love rules from 'error' to 'warn' so they inform without blocking.
// Polecats should run: eslint --fix && prettier --write src
function warnify(rules) {
  const result = {}
  for (const [key, value] of Object.entries(rules ?? {})) {
    if (Array.isArray(value)) {
      result[key] = value[0] === 'error' || value[0] === 2
        ? ['warn', ...value.slice(1)]
        : value
    } else {
      result[key] = value === 'error' || value === 2 ? 'warn' : value
    }
  }
  return result
}

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
      ...warnify(love.rules),
      ...prettier.rules,
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-magic-numbers': [
        'warn',
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
