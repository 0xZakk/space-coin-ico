https://github.com/ZakkMan/space-coin-ico

The following is a micro audit of git commit 7824e5317ee6bc774b2d6e2431b8414e7813ec02 by Gilbert.


## General comments

- No tax feature
- Your use of modifiers isn't wrong, but be aware they're normally used for logic shared across functions. Some programmers out there (ones hiring, specifically) may not like that.


## issue-1

**[High]** Individual address contribution limits are not enforced

belowMaxContribution() only checks if `msg.value` is within the limit. An address can call invest() multiple times to go over the individual limit.


## issue-2

**[High]** Withdraw always transfers 500 tokens

ICO.sol:73 has a hardcoded value for transfering tokens.


## issue-3

**[Low]** Owner cannot remove seed investors

SpaceTokenIco only allows adding investors through addInvestor(). Consider updating the function to allow removal as well, in case the owner changes their mind or makes a mistake.


## issue-4

**[Code Quality]** addInvestor() transaction costs

Depending on the number of seed investors the client needs, consider updating addInvestor to accept an array of addresses so the owner can make fewer transactions.


## Nitpicks

- In withdraw(), you can move the `uint balance` assignment to the top of the function and use `balance` in your require statement to avoid reading from storage twice.
- _transitionPhaseForward() is a separate function but it's only used in one place.