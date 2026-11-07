module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {allowTemplateLiterals: true}],
    "max-len": ["error", {code: 140, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: true}],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "object-curly-spacing": "off",
    "comma-dangle": "off",
    "arrow-parens": "off",
    "operator-linebreak": "off",
    "indent": "off",
    "no-unused-vars": ["error", {ignoreRestSiblings: true}],
  },
  overrides: [
    {
      files: ["test/**"],
      parserOptions: {sourceType: "module"},
      rules: {"no-unused-vars": "off"},
    },
  ],
  globals: {},
};
