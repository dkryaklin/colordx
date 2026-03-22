/** @type {import('prettier').Config} */
export default {
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 120,
  semi: true,
  singleQuote: true,
  importOrder: [
    '^node:(.*)$',
    '<THIRD_PARTY_MODULES>',
    '^[./]',
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  overrides: [
    {
      files: ['**/*.entity.ts', '**/entities/*.ts'],
      options: {
        plugins: [],
      },
    },
  ],
};
