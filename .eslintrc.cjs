module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'functions', 'node_modules'],
  rules: { 'react/prop-types': 'off' },
  overrides: [
    {
      // The UI never touches a vendor SDK: only src/api may (SYSTEM_DESIGN.md section 7.6).
      files: ['src/**'],
      excludedFiles: ['src/api/**'],
      rules: {
        'no-restricted-imports': ['error', { patterns: ['firebase', 'firebase/*', 'razorpay'] }],
      },
    },
    { files: ['**/*.test.{js,jsx}'], env: { node: true } },
  ],
};
