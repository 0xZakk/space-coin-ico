const { ethers } = require("hardhat");
const { BigNumber } = ethers
const bn = require('bignumber.js');

module.exports.expandTo18Decimals = (n) => {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

// Source: https://github.com/ethers-io/ethers.js/issues/1182#issuecomment-897356864
// Reason: BN.js (used by ethers) doesn't have a method for calculating the square
//    root, but bignumber.js (they're different libraries for working with big
//    numbers). So, take a BN.js value, convert it to bignumber.js, get the square
//    root, then convert it back to BN.js.
module.exports.sqrt = (value) => {
  return BigNumber.from(new bn(value.toString()).sqrt().toFixed().split('.')[0])
}