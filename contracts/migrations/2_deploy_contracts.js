var OriginToken = artifacts.require("./OriginToken.sol")
var TutorialToken = artifacts.require("./TutorialToken.sol")
var ListingsRegistry = artifacts.require("./ListingsRegistry.sol")
var Listing = artifacts.require("./Listing.sol")
var UserRegistry = artifacts.require("./UserRegistry.sol")
var PurchaseLibrary = artifacts.require("./PurchaseLibrary.sol")

module.exports = function(deployer) {
  deployer.deploy(TutorialToken)
  deployer.deploy(OriginToken).then(function(){
    deployer.deploy(PurchaseLibrary)
    deployer.link(PurchaseLibrary, ListingsRegistry)
    deployer.link(PurchaseLibrary, Listing)
    deployer.deploy(ListingsRegistry, OriginToken.address)
    deployer.deploy(UserRegistry)
  })
};
