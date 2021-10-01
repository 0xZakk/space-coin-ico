//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import { SpaceToken } from "./Token.sol";

/**
 * The SpaceTokenICO contract does this and that...
 */
contract SpaceTokenICO is Ownable, Pausable {
  uint constant SEED_MAX_INDIVIDUAL_CONTRIBUTION = 1500 ether;
  uint constant GENERAL_MAX_INDIVIDUAL_CONTRIBUTION = 1000 ether;
  uint constant SEED_PHASE_CONTRIBUTION_LIMIT = 15000 ether;
  uint constant GENERAL_PHASE_CONTRIBUTION_LIMIT = 30000 ether;
  SpaceToken public tokenAddress;
  mapping(address => bool) public investorWhitelist;
  mapping(address => uint) public investorContributions;
  enum Phase {
    SEED,
    GENERAL,
    OPEN
  }
  Phase public currentPhase;

  modifier onlyWhitelistedInvestors() { 
    if(currentPhase == Phase.SEED) {
      require(investorWhitelist[msg.sender], "INVALID_CONTRIBUTION:Investor not whitelisted."); 
    }
    _; 
  }

  modifier belowMaxContribution() { 
    if(currentPhase == Phase.SEED) {
      require (msg.value <= SEED_MAX_INDIVIDUAL_CONTRIBUTION, "INVALID_CONTRIBUTION:Contribution too large."); 
    } else if (currentPhase == Phase.GENERAL) {
      require (msg.value <= GENERAL_MAX_INDIVIDUAL_CONTRIBUTION, "INVALID_CONTRIBUTION:Contribution too large."); 
    }
    _; 
  }

  // modifier onlyDuringPhase(Phase _phase) { 
  //   require (currentPhase == _phase); 
  //   _; 
  // }
  
  
  constructor() {
    tokenAddress = new SpaceToken();
  }

  function invest () external payable whenNotPaused onlyWhitelistedInvestors belowMaxContribution {
    investorContributions[msg.sender] += msg.value;

    if (currentPhase == Phase.SEED && _getBalance() >= SEED_PHASE_CONTRIBUTION_LIMIT) {
      _pause();
    } else if (currentPhase == Phase.GENERAL && _getBalance() >= GENERAL_PHASE_CONTRIBUTION_LIMIT) {
      _pause();
    }
  }

  function withdraw () external {
    require(investorContributions[msg.sender] > 0);
    require(currentPhase == Phase.OPEN);

    uint balance = investorContributions[msg.sender];
    investorContributions[msg.sender] = 0;

    tokenAddress.transfer(msg.sender, 500);
  }

  function _getBalance () internal view returns (uint balance) {
    return uint(address(this).balance);
  }
  
  function getBalance () external view returns(uint balance) {
    return _getBalance();
  }

  function getContribution (address investorAddress) external view returns(uint contributionAmount) {
    return investorContributions[investorAddress];
  }

  function addInvestor (address investor) external onlyOwner {
    investorWhitelist[investor] = true;
  }

  function isOnWhitelist(address investor) external view returns (bool) {
    return investorWhitelist[investor];
  }

  function _transitionPhaseForward () internal {
    currentPhase = Phase(uint(currentPhase) + 1);

    if(paused()) {
      _unpause();
    }
  }
  
  function transitionPhaseForward () external onlyOwner {
    _transitionPhaseForward();
  }

  function pauseFundraising () external onlyOwner whenNotPaused {
    _pause();
  }

  function resumeFundraising () external onlyOwner whenPaused {
    _unpause();
  }
}
