module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    extraFileExtensions: ['.txt'],
  },
  plugins: ['@typescript-eslint', 'jest'],
  extends: ['airbnb-typescript/base', 'prettier'],
  env: {
    'jest/globals': true,
  },
};
