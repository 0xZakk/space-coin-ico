// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * The Math
 */
library Math {
  // Source: https://github.com/Uniswap/v2-core/blob/4dd59067c76dea4a0e8e4bfdda41877a6b16dedc/contracts/libraries/Math.sol#L6-L8
  function min(uint x, uint y) internal pure returns (uint z) {
      z = x < y ? x : y;
  }
  
  // Source: https://github.com/Uniswap/v2-core/blob/4dd59067c76dea4a0e8e4bfdda41877a6b16dedc/contracts/libraries/Math.sol#L10-L22
  function sqrt(uint y) internal pure returns (uint z) {
      if (y > 3) {
          z = y;
          uint x = y / 2 + 1;
          while (x < z) {
              z = x;
              x = (y / x + x) / 2;
          }
      } else if (y != 0) {
          z = 1;
      }
  }
}

