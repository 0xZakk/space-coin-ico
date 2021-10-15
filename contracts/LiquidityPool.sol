// SPDX-License-Identifier: MIT
/*
 * Created on 2021-10-13 22:14
 * @summary: 
 * @author: zacharyfleischmann
 */
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { SpaceToken } from "./Token.sol";
import { ERC20 } from "./ERC20.sol";
import "./libraries/Math.sol";

/*
 * @title: Liquidity Pool
 */
contract LiquidityPool is ERC20, Ownable, Pausable, ReentrancyGuard {
  using SafeMath for uint;

  uint public constant MINIMUM_LIQUIDITY = 10**3;

  uint private reserveEth;
  uint private reserveSpace;
  uint32 private blockTimestampLast;

  uint public priceEthCumulativeLast;
  uint public priceSpcCumulativeLast;
  uint public kLast; // reserveEth * reserveSpace

  enum Tokens { Eth, Space }
  mapping (address => mapping(Tokens => uint)) providerBalances;

  SpaceToken public spaceToken; 

  event Mint(address indexed sender, uint amountEth, uint amountSpc);
  event Burn(address indexed sender, uint amountEth, uint amountSpc, address indexed to);
  event Swap(
    address indexed sender,
    uint amountEthIn,
    uint amountSpcIn,
    uint amountEthOut,
    uint amountSpcOut
  );
  event Sync(uint amountEth, uint amountSpc);

  bool private unlocked = true;
  modifier lock() {
      require(unlocked, 'LOCKED');
      unlocked = false;
      _;
      unlocked = true;
  }

  constructor(SpaceToken _tokenAddress) ERC20("Space LP Token", "lpSpace") {
    spaceToken = _tokenAddress;
  }

  /*
   * returns the token address for $SPC.
   */
  function tokenAddress () external view returns(address) {
    return address(spaceToken);
  }

  /*
   * Returns the reserve balance of Eth and $SPC for the current block.
   * reserveEth balance of Eth in reserve
   * reserveSpc balance of $SPC in reserve
   * blockTimestampLast timestamp reserve values were last checked
   */
  function getReserves () public view returns (uint _reserveEth, uint _reserveSpc, uint _blockTimestampLast) {
    _reserveEth = reserveEth;
    _reserveSpc = reserveSpace;
    _blockTimestampLast = blockTimestampLast;
  }

  /*
   * Updates reserve values and sets the blockTimestampLast
   */
  function _update (uint _balanceEth, uint _balanceSpc, uint _reserveEth, uint _reserveSpc) private {
    // - get reserves
    // - get balances
    // - update reserves to balances at the end of each block
    // uint32 blockTimestamp = uint32(block.timestamp % 2**32);
    // uint32 timeElapsed = blockTimestamp - blockTimestampLast;

    reserveEth = address(this).balance;
    reserveSpace = spaceToken.balanceOf(address(this));
    // blockTimestampLast = blockTimestamp;
    emit Sync(reserveEth, reserveSpace);
  }

  /*
   * Accepts a balance of Eth and $SPC and mints LP tokens for the
   *       sender. If it's the first mint (i.e. totalSupply = 0), then the
   *       initial supply should be created with the minimum liquidity burned.
   */
  function mint (address to, uint _amountEth, uint _amountSpc) external payable lock returns (uint liquidity) {
    require(_amountEth == msg.value, "Eth value mismatch");

    // assert here?
    spaceToken.transferFrom(msg.sender, address(this), _amountSpc);

    (uint _reserveEth, uint _reserveSpc,) = getReserves();

    uint balanceEth = address(this).balance;
    uint balanceSpc = spaceToken.balanceOf(address(this));

    uint amountEth = balanceEth.sub(_reserveEth);
    uint amountSpc = balanceSpc.sub(_reserveSpc);

    uint _totalSupply = totalSupply();

    if (_totalSupply == 0) {
      liquidity = Math.sqrt(amountEth.mul(amountSpc)).sub(MINIMUM_LIQUIDITY);
      _mint(address(0), MINIMUM_LIQUIDITY);
    } else {
      liquidity = Math.min(
        amountEth.mul(_totalSupply) / _reserveEth,
        amountSpc.mul(_totalSupply) / _reserveSpc
      );
    }

    require(liquidity > 0, "Insufficient liquidity");

    _mint(to, liquidity);
    _update(balanceEth, balanceSpc, _reserveEth, _reserveSpc);

    // if (feeOn) {
    //   kLast = uint(reserveEth).mul(reserveSpace);
    // }

    emit Mint(msg.sender, amountEth, amountSpc);
  }

  /*
   * Accepts LP tokens and burns them in exchange for Eth and $SPC.
   */
  function burn (uint _burnAmount) external lock returns (uint amountEth, uint amountSpc) {
    require(_burnAmount <= balanceOf(msg.sender), "Not enough LP tokens");
    (uint _reserveEth, uint _reserveSpc,) = getReserves();

    // get actual balances
    uint balanceEth = address(this).balance;
    uint balanceSpc = spaceToken.balanceOf(address(this));

    uint _totalSupply = totalSupply();

    amountEth = _burnAmount.mul(balanceEth) / _totalSupply;
    amountSpc = _burnAmount.mul(balanceSpc) / _totalSupply;
    require(amountEth > 0 && amountSpc > 0, 'Insufficient liquidity burned');

    // Transfer LP tokens back to the pool before burning them
    transfer(address(this), _burnAmount);
    _burn(address(this), _burnAmount);

    // Transfer $SPC and Eth back to provider
    spaceToken.transfer(msg.sender, amountSpc);
    (bool sent, bytes memory data) = msg.sender.call{value: amountEth}("");
    require(sent, "Failed to send Ether");

    balanceEth = address(this).balance;
    balanceSpc = spaceToken.balanceOf(address(this));

    _update(balanceEth, balanceSpc, _reserveEth, _reserveSpc);

    // if (feeOn) {
    //   kLast = uint(reserveEth).mul(reserveSpace);
    // }

    emit Burn(msg.sender, amountEth, amountSpc, msg.sender);
  }

  function _getPrice(uint _amountIn, uint _reserveOut, uint _reserveIn) private view returns (uint amountOut) {
    require(_amountIn > 0, "Insufficient Amount");
    require(_reserveIn > 0 && _reserveOut > 0, 'Insufficient Liquidity');
    // console.log("_amountIn  ", _amountIn);
    // console.log("_reserveIn ", _reserveIn);
    // console.log("_reserveOut", _reserveOut);
    amountOut = _amountIn.mul(_reserveOut) / _reserveIn;
  }

  /*
   * Accepts an amount of Eth and returns the corresponding amount of SPC. 
   */
  function swapSpaceForEth(uint _spcIn) external lock {
    (uint _reserveEth, uint _reserveSpc,) = getReserves();
    require(_spcIn < _reserveSpc, "Insufficient liquidity");

    // Not sure why I need these
    uint balanceEth = address(this).balance;
    uint balanceSpc = spaceToken.balanceOf(address(this));

    // transfer space from sender (swapper) to pool
    spaceToken.transferFrom(msg.sender, address(this), _spcIn);

    // calculate price of eth in $spc
    uint ethOut = _getPrice(_spcIn, _reserveSpc, _reserveEth);
    // console.log("ethOut", ethOut);
    // calculate amount of eth to send to msg.sender
    // send eth to msg.sender
    (bool sent, bytes memory data) = msg.sender.call{value:ethOut}("");
    require(sent, "Failed to send Ether");

    _update(balanceEth, balanceSpc, _reserveEth, _reserveSpc);
    emit Swap(msg.sender, 0, _spcIn, ethOut, 0);
  }

  /*
   * Accepts an amount of $SPC and returns the corresponding amount of Eth.
   */
  function swapEthforSpace () external payable lock {
    (uint _reserveEth, uint _reserveSpc,) = getReserves();
    require(msg.value < _reserveEth, "Insufficient liquidity");

    // Not sure why I need these
    uint balanceEth = address(this).balance;
    uint balanceSpc = spaceToken.balanceOf(address(this));

    uint spcOut = _getPrice(msg.value, _reserveEth, _reserveSpc);
    require(spcOut < _reserveSpc, "Insufficient liquidity");

    bool sent = spaceToken.transfer(msg.sender, spcOut);
    require(sent, "Failed to send $SPC");

    _update(balanceEth, balanceSpc, _reserveEth, _reserveSpc);
    emit Swap(msg.sender, msg.value, 0, 0, spcOut);
  }
}
