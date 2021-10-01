//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SpaceToken is ERC20 {
    uint constant MAX_SUPPLY = 500000;
    uint constant TAX = 2;
    bool public isTaxed = true;
    address public owner;

    constructor() ERC20("SpaceToken", "SPACE") {
        owner = msg.sender;
        _mint(msg.sender, MAX_SUPPLY);
    }
}