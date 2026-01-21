module.exports = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
  },
};
