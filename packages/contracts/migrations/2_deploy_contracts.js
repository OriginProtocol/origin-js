var OriginRegistry = artifacts.require("OriginRegistry");
var ListingsRegistry = artifacts.require("ListingsRegistry");
var UserRegistry = artifacts.require("UserRegistry");
var ReputationRegistry = artifacts.require("ReputationRegistry");

module.exports = function(deployer) {
  deployer.deploy(OriginRegistry).then( function() {
      return deployer.deploy(ReputationRegistry);
  }).then(function() {
    return ReputationRegistry.deployed();
  }).then(function(instance) {
      return instance.registerContract(ReputationRegistry.contractName, OriginRegistry.address);
  }).then(function() {
      return deployer.deploy(ListingsRegistry);
  }).then(function() {
    return ListingsRegistry.deployed();
  }).then(function(instance) {
    return instance.registerContract(ListingsRegistry.contractName, OriginRegistry.address);
  });
  //not dependent yet
  deployer.deploy(UserRegistry);
};
