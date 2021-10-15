commit 7824e5317ee6bc774b2d6e2431b8414e7813ec02

## issue

**[High]** Unimplemented Requirement.

The following requirement was not meant in Token.sol

```
A 2% tax on every transfer that gets put into a treasury
A flag that toggles this tax on/off, controllable by owner, initialized to false
```

## issue
**[High]** Decimals not implemented.

contracts/Token.sol:15 Token is minted without using decimals.  `_mint(msg.sender, MAX_SUPPLY);`

This would effectively make trading fractions on SpaceToken impossible.


## issue
**[High]** Allows funding past funding goal.

contracts/ICO.sol:59 `if (currentPhase == Phase.SEED && _getBalance() >= SEED_PHASE_CONTRIBUTION_LIMIT) {`
contracts/ICO.sol:61 `if (currentPhase == Phase.SEED && _getBalance() >= SEED_PHASE_CONTRIBUTION_LIMIT) {`

If the funding goal is 15000 for the Seed Phase and the total investment amount to 14000, then the Seed Phase would required 1000 ether to reach it's funding goal. If an investors submits a 1500 transaction there is presently nothing that would stop the funding goal from excedding 15000.


## issue
**[High]** Contract pausing is implemented erroneously.

contracts/ICO.sol:59 - 63 

```
  if (currentPhase == Phase.SEED && _getBalance() >= SEED_PHASE_CONTRIBUTION_LIMIT) {
    _pause();
  } else if (currentPhase == Phase.GENERAL && _getBalance() >= GENERAL_PHASE_CONTRIBUTION_LIMIT) {
    _pause();
  }
```
The project spec did not call for contract funding to execute a pause or unpause. Only the contract owner can pause the contract.


## issue
**[High]** Token mints 500 tokens by default, not investor's total contribution.

contracts/ICO.sol:73 `tokenAddress.transfer(msg.sender, 500)`

Clearly was meant to use the local variable `balance`.

## issue

**[Medium]** Using contract balance can lead to the wrong balance being returned.

/contracts/Ico.sol:77 `return uint(address(this).balance);`

Due to the selfdestruct method, an attacker can forcibly send you ether. This can be potentially be used to inflate your contract balance.

Consider: Introducing a state variable "totalInvestments" that you can manally update in the `invest()` method. If the contract receives funds from outside of the `invest()` method, one would be able to easily notice a discrepancy in contract balance vs 'totalInvestments'. Refer to https://solidity-by-example.org/hacks/self-destruct/


## issue
**[Code-Quality]** Unused local variable.

contracts/ICO.sol:69 `uint balance` is declared but value is never used.

## issue
**[Code-Quality]** Commented code.

contracts/ICO.sol:46-49: Commented code not in use.

## issue
**[Code-Quality]** Duplicated code.

contracts/ICO.sol:46-49: Code block contains duplicated code.

```
 function _getBalance () internal view returns (uint balance) {
    return uint(address(this).balance);
  }
  
  function getBalance () external view returns(uint balance) {
    return _getBalance();
  }
```

These lines of code can be reduced by having a local variable that tracks the contract balance manually with a visibility set to public. Same applies to _transitionPhaseForward and the associated getter.
