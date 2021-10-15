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
  uint public balance;
  uint constant SEED_MAX_INDIVIDUAL_CONTRIBUTION = 1500 ether;
  uint constant GENERAL_MAX_INDIVIDUAL_CONTRIBUTION = 1000 ether;
  uint constant SEED_PHASE_CONTRIBUTION_LIMIT = 15000 ether;
  uint constant GENERAL_PHASE_CONTRIBUTION_LIMIT = 30000 ether;
  SpaceToken public tokenAddress;
  mapping(address => bool) public investorWhitelist;
  mapping(address => uint) public investorContributions;
  mapping(Phase => mapping(address => uint)) public investorContributionsByPhase;

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
      require ((msg.value + investorContributionsByPhase[currentPhase][msg.sender]) <= SEED_MAX_INDIVIDUAL_CONTRIBUTION, "INVALID_CONTRIBUTION:Contribution too large."); 
    } else if (currentPhase == Phase.GENERAL) {
      require ((msg.value + investorContributionsByPhase[currentPhase][msg.sender]) <= GENERAL_MAX_INDIVIDUAL_CONTRIBUTION, "INVALID_CONTRIBUTION:Contribution too large."); 
    }
    _;
  }

  // modifier onlyDuringPhase(Phase _phase) { 
  //   require (currentPhase == _phase); 
  //   _; 
  // }
  
  
  constructor() {}

  function setTokenAddress(SpaceToken _spaceToken) external {
    require(address(tokenAddress) == address(0x0), "WRITE_ONCE");
    tokenAddress = _spaceToken;
  }

  function invest () external payable whenNotPaused onlyWhitelistedInvestors belowMaxContribution {
    balance += msg.value;
    investorContributions[msg.sender] += msg.value;
    investorContributionsByPhase[currentPhase][msg.sender] += msg.value;

    if (currentPhase == Phase.SEED && getBalance() >= SEED_PHASE_CONTRIBUTION_LIMIT) {
      _pause();
    } else if (currentPhase == Phase.GENERAL && getBalance() >= GENERAL_PHASE_CONTRIBUTION_LIMIT) {
      _pause();
    }
  }

  function claim () external {
    require(investorContributions[msg.sender] > 0, "DID_NOT_PARTICIPATE");
    require(currentPhase == Phase.OPEN, "NOT_OPEN");

    uint contribution = investorContributions[msg.sender];
    investorContributions[msg.sender] = 0;

    tokenAddress.transfer(msg.sender, contribution * 5);
  }

  function getBalance () public view returns(uint) {
    return balance;
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
