module.exports = {
  root: true,
  parser: 'babel-eslint',
  extends: [
    'eslint:recommended'
  ],
  env: {
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
  }
};
