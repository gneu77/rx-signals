module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    extraFileExtensions: ['.txt'],
  },
  plugins: ['import', '@typescript-eslint', 'jest'],
  extends: ['airbnb-typescript/base', 'prettier', 'plugin:import/recommended'],
  env: {
    'jest/globals': true,
  },
};
