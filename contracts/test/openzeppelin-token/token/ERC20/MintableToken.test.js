/* eslint-disable semi,no-unused-vars,no-extra-semi */
import shouldBehaveLikeMintableToken from './MintableToken.behaviour';
const EternalStorage = artifacts.require('EternalStorage');
const MintableToken = artifacts.require('MintableTokenMock');

contract('MintableToken', function ([owner, anotherAccount]) {
  const minter = owner;

  beforeEach(async function () {
    const es = await EternalStorage.new({from: owner});
    this.token = await MintableToken.new(es.address, {from: owner});
    await es.addWriter(this.token.address, {from: owner});
  });

  shouldBehaveLikeMintableToken([owner, anotherAccount, minter]);
});
