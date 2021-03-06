module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    jest: true,
    node: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  globals: {
    Log: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {},
}
