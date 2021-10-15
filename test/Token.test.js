const hre = require("hardhat");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { parseEther, formatEther } = require("ethers/lib/utils");

chai.use(solidity);

const { expect } = chai;

describe("Token contract", function() {
  let TokenContract;
  let spaceToken;
  let treasury;
  let ico;
  let contributor1;
  let contributor2;
  let contributor3;
  let addrs;

  beforeEach(async function() {
    TokenContract = await ethers.getContractFactory("SpaceToken");
    [
      treasury,
      ico,
      contributor1,
      contributor2,
      contributor3,
      ...addrs
    ] = await ethers.getSigners();

    spaceToken = await TokenContract.deploy(treasury.address, ico.address);
    await spaceToken.deployed();

    await spaceToken.deployed();
  });

  describe("Deployment", function() {
    it("Should set the right owner", async function() {
      expect(await spaceToken.owner()).to.equal(treasury.address);
    });

    it("Should create the correct max supply (500,000 * 10)", async function() {
      expect(await spaceToken.totalSupply()).to.equal(
        "500000000000000000000000"
      );
    });

    it("Should assign the ICO amount to the ICO address", async function () {
      expect(await spaceToken.balanceOf(ico.address)).to.equal("150000000000000000000000");
    })

    it('Should assign the treasury amount to the treasury address', async function () {
      expect(await spaceToken.balanceOf(treasury.address)).to.equal("350000000000000000000000")
    });

    it('Should set the treasury address', async function () {
      expect(await spaceToken.treasury()).to.equal(treasury.address);
    });
  });

  describe('Taxation', function () {
    it('Should start with taxation off by default', async function () {
      expect(await spaceToken.isTaxed()).to.be.false;
    });

    it('Should be able to toggle taxation', async function () {
      expect(await spaceToken.isTaxed()).to.be.false;
      await spaceToken.toggleTaxation();
      expect(await spaceToken.isTaxed()).to.be.true;
    });

    it('Should limit who can toggle taxation to only the owner', async function () {
      await expect(spaceToken.connect(contributor1).toggleTaxation()).to.be.reverted;
    });
  });

  describe("Transactions", function() {
    it("Should transfer tokens between accounts", async function() {
      // Transfer 100 tokens from owner to contributor1
      await spaceToken.transfer(contributor1.address, 100);
      const addr1Balance = await spaceToken.balanceOf(contributor1.address);
      expect(addr1Balance).to.equal(100);

      // Transfer 50 tokens from contributor1 to contributor2
      // We use .connect(signer) to send a transaction from another account
      await spaceToken.connect(contributor1).transfer(contributor2.address, 50);
      const addr2Balance = await spaceToken.balanceOf(contributor2.address);
      expect(addr2Balance).to.equal(50);
    });

    it("Should fail if sender doesn’t have enough tokens", async function() {
      const initialOwnerBalance = await spaceToken.balanceOf(treasury.address);

      // Try to send 1 token from contributor1 (0 tokens) to owner (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(spaceToken.connect(contributor1).transfer(treasury.address, 1))
        .to.be.reverted;

      // Owner balance shouldn't have changed.
      expect(await spaceToken.balanceOf(treasury.address)).to.equal(
        initialOwnerBalance
      );
    });

    it("Should update balances after transfers", async function() {
      const initialOwnerBalance = await spaceToken.balanceOf(treasury.address);

      // Transfer 100 tokens from owner to contributor1.
      await spaceToken.transfer(contributor1.address, 100);

      // Transfer another 50 tokens from owner to contributor2.
      await spaceToken.transfer(contributor2.address, 50);

      // Check balances.
      const finalOwnerBalance = await spaceToken.balanceOf(treasury.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(150));

      const addr1Balance = await spaceToken.balanceOf(contributor1.address);
      expect(addr1Balance).to.equal(100);

      const addr2Balance = await spaceToken.balanceOf(contributor2.address);
      expect(addr2Balance).to.equal(50);
    });

    it('Should apply tax on transactions when taxing', async function () {
      await spaceToken.transfer(contributor1.address, 100);
      const addr1Balance = await spaceToken.balanceOf(contributor1.address);
      expect(addr1Balance).to.equal(100);

      await spaceToken.toggleTaxation(); // turn on taxing

      await spaceToken.connect(contributor1).transfer(contributor2.address, 50);
      const addr2Balance = await spaceToken.balanceOf(contributor2.address);
      expect(addr2Balance).to.equal(50 * 0.98);
    });
  });
});
