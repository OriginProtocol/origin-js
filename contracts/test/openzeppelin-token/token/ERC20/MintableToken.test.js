/* eslint-disable semi,no-unused-vars,no-extra-semi */
import shouldBehaveLikeMintableToken from './MintableToken.behaviour';
import { newOriginToken } from '../../../token/helpers.js';

contract('MintableToken', function ([owner, anotherAccount]) {
  const minter = owner;

  beforeEach(async function () {
    this.token = await newOriginToken();
  });

  shouldBehaveLikeMintableToken([owner, anotherAccount, minter]);
});
