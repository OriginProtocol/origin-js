module.exports = {
  root: true,
  parser: "babel-eslint",
  extends: [
    "eslint:recommended"
  ],
  env: {
    browser: true,
    es6: true,
    mocha: true,
    node: true
  },
  globals: {
    artifacts: true,
    assert: true,
    contract: true,
    expect: true,
    web3: true
  },
  rules: {
    indent: ["error", 2],
    "no-console": ["off"],
    "no-var": ["error"],
    "prefer-const": ["error"],
    semi: ["error", "never"],
    quotes: [
      "error",
      "double",
      {
        "avoidEscape": true,
        "allowTemplateLiterals": true
      }
    ]
  }
}
