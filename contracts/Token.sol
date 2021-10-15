//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SpaceToken is ERC20, Ownable {
    uint public MAX_SUPPLY;
    bool public isTaxed = false;
    uint constant TAX = 2;
    uint constant ONE_COIN = 10 ** 18; 
    address public treasury;

    constructor(address _treasury, address _ico) ERC20("SpaceToken", "SPACE") {
        treasury = _treasury;
        MAX_SUPPLY = ONE_COIN * 500000;
        uint icoAmount = ONE_COIN * 30000 * 5;
        _mint(_ico, icoAmount);
        _mint(_treasury, MAX_SUPPLY - icoAmount);
    }

    function toggleTaxation () external onlyOwner {
        isTaxed = !isTaxed;
    }

    function _transfer (address sender, address receiver, uint amount) internal virtual override {
        require(amount > 0, "Amount can't be zero");

        if (isTaxed) {
            uint taxAmount = amount * 2 / 100;
            amount = amount - taxAmount;
            super._transfer(sender, treasury, taxAmount);
        }
        super._transfer(sender, receiver, amount);
    }
}