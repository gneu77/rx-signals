module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    extraFileExtensions: ['.txt'],
  },
  plugins: ['@typescript-eslint', 'jest'],
  extends: ['airbnb-typescript/base', 'prettier', 'prettier/@typescript-eslint'],
  env: {
    'jest/globals': true,
  },
};
