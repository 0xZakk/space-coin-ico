const { expect } = require("chai");

describe("Token contract", function () {
  let TokenContract;
  let spaceToken;
  let owner;
  let contributor1;
  let contributor2;
  let contributor3;
  let addrs;

  beforeEach(async function () {
    TokenContract = await ethers.getContractFactory("SpaceToken");
    [owner, contributor1, contributor2, contributor3, ...addrs] = await ethers.getSigners();

    spaceToken = await TokenContract.deploy();
    await spaceToken.deployed();

    await spaceToken.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await spaceToken.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await spaceToken.balanceOf(owner.address);
      expect(await spaceToken.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Transfer 50 tokens from owner to contributor1
      await spaceToken.transfer(contributor1.address, 50);
      const addr1Balance = await spaceToken.balanceOf(
        contributor1.address
      );
      expect(addr1Balance).to.equal(50);

      // Transfer 50 tokens from contributor1 to contributor2
      // We use .connect(signer) to send a transaction from another account
      await spaceToken.connect(contributor1).transfer(contributor2.address, 50);
      const addr2Balance = await spaceToken.balanceOf(
        contributor2.address
      );
      expect(addr2Balance).to.equal(50);
    });

    it("Should fail if sender doesn’t have enough tokens", async function () {
      const initialOwnerBalance = await spaceToken.balanceOf(
        owner.address
      );

      // Try to send 1 token from contributor1 (0 tokens) to owner (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(
        spaceToken.connect(contributor1).transfer(owner.address, 1)
      ).to.be.reverted

      // Owner balance shouldn't have changed.
      expect(await spaceToken.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      );
    });

    it("Should update balances after transfers", async function () {
      const initialOwnerBalance = await spaceToken.balanceOf(
        owner.address
      );

      // Transfer 100 tokens from owner to contributor1.
      await spaceToken.transfer(contributor1.address, 100);

      // Transfer another 50 tokens from owner to contributor2.
      await spaceToken.transfer(contributor2.address, 50);

      // Check balances.
      const finalOwnerBalance = await spaceToken.balanceOf(
        owner.address
      );
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - 150);

      const addr1Balance = await spaceToken.balanceOf(
        contributor1.address
      );
      expect(addr1Balance).to.equal(100);

      const addr2Balance = await spaceToken.balanceOf(
        contributor2.address
      );
      expect(addr2Balance).to.equal(50);
    });
  });
});
