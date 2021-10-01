const hre = require("hardhat");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { parseEther, formatEther } = require("ethers/lib/utils");

chai.use(solidity);

const { expect } = chai;

describe("ICO contract", function () {
  let provider;
  let Contract;
  let contract;
  let TokenContract;
  let spaceToken;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addrs;

  beforeEach(async function () {
    provider = ethers.getDefaultProvider();
    Contract = await ethers.getContractFactory("SpaceTokenICO");
    TokenContract = await ethers.getContractFactory("SpaceToken");
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    // const balance = await addr1.getBalance();
    // console.log(balance.toString())
    // console.log(await provider.getBalance(addr1.address))

    contract = await Contract.deploy();
    await contract.deployed();
    await contract.deployed();

    spaceToken = await TokenContract.attach(await contract.tokenAddress())
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it('Should have a starting balance of SpaceToken', async function () {
      const tokenBalance = await spaceToken.balanceOf(contract.address)
      expect(tokenBalance).to.equal(500000)
    });
  });

  describe("Investor Whitelist", function () {
    it("Should check if an address is on the whitelist", async function () {
      expect(await contract.isOnWhitelist(addr1.address)).to.be.false;
    });

    it("Should let the contract owner add to the whitelist", async function () {
      await contract.connect(owner).addInvestor(addr1.address);
      expect(await contract.isOnWhitelist(addr1.address)).to.true;
    });

    it("Should only let the owner add investors", async function () {
      await expect(contract.connect(addr1).addInvestor(addr1.address)).to.be
        .reverted;
    });
  });

  describe("Pause Fundraising", function () {
    // start of as unpaused
    it("Should start off unpaused", async function () {
      expect(await contract.connect(owner).paused()).to.be.false;
    });

    // owner can pause fundraising
    it("Should let the owner pause fundraising", async function () {
      await contract.connect(owner).pauseFundraising();
      expect(await contract.connect(owner).paused()).to.be.true;
    });

    // owner can unpause fundraising
    it("Should be able to unpause fundraising", async function () {
      await contract.connect(owner).pauseFundraising();
      await contract.connect(owner).resumeFundraising();

      expect(await contract.connect(owner).paused()).to.be.false;
    });

    it("Should limit pausing to just the owner", async function () {
      await expect(contract.connect(addr1).pauseFundraising()).to.be.reverted;
    });

    it("Should limit resuming to just the owner", async function () {
      await expect(contract.connect(addr1).resumeFundraising()).to.be.reverted;
    });
  });

  describe("Fundraising Phases", function () {
    // Should start in phase Seed
    it("Should start off at the Seed phase", async function () {
      expect(await contract.currentPhase()).to.equal(0);
    });

    // Owner can move phase forward (Seed --> General --> Open)
    it("Should let the owner move the phase forward", async function () {
      await contract.transitionPhaseForward();
      expect(await contract.currentPhase()).to.equal(1);
      await contract.transitionPhaseForward();
      expect(await contract.currentPhase()).to.equal(2);
    });

    it("Should prevent moving past the Open phase", async function () {
      await contract.transitionPhaseForward(); // General
      await contract.transitionPhaseForward(); // Open
      await expect(contract.transitionPhaseForward()).to.be.reverted;
      expect(await contract.currentPhase()).to.equal(2);
    });

    // only owner
    it("Should only let the owner move the phase forward", async function () {
      await expect(contract.connect(addr1).transitionPhaseForward()).to.be
        .reverted;
    });

    it('Should unpause fundraising when the phase is moved forward', async function () {
      await contract.pauseFundraising()
      await contract.transitionPhaseForward();

      expect(await contract.connect(owner).paused()).to.be.false;
    });
  });

  describe("Contribute", function () {
    // when paused, no one should be able to contribute
    it("Should prevent contributions when fundraising is paused", async function () {
      await contract.pauseFundraising();

      await expect(contract.invest({ value: parseEther("100") })).to.be
        .reverted;
    });

    it("Should be able to get the balance of the contract", async function () {
      const investment = parseEther("100");

      await contract.addInvestor(owner.address);
      await contract.connect(owner).invest({ value: investment });

      expect(await contract.getBalance()).to.equal(investment);
    });

    it('Should be able to retrieve the amount an address has contributed', async function () {
      const investment1 = parseEther("283");
      const investment2 = parseEther("384");
      const invested = investment1.add(investment2)

      await contract.addInvestor(owner.address);
      await contract.invest({ value: investment1 });
      await contract.invest({ value: investment2 });

      expect(await contract.getContribution(owner.address)).to.equal(invested)
    });

    describe("Seed Phase", function () {
      // only white listed investors can contribute
      it("Should only let whitelisted investors contribute", async function () {
        await expect(
          contract.connect(addr1).invest({ value: parseEther("100") })
        ).to.be.reverted;
      });

      it("Should change the contract balance", async function () {
        const investment = parseEther("100");

        await contract.connect(owner).addInvestor(addr1.address);

        await expect(
          await contract.connect(addr1).invest({ value: investment })
        ).to.changeEtherBalance(contract, investment);
      });
      // can't contribute more than 1,500 Eth
      it("Should limit individual contributions to 1,500 Eth", async function () {
        await contract.connect(owner).addInvestor(addr1.address);
        await expect(
          contract.connect(addr1).invest({ value: parseEther("2000") })
        ).to.be.reverted;
      });

      // max contribution is 15,000
      it("Should pause funding when the 15,000 Ether goal is met", async function () {
        const investment = parseEther("1500");

        for (let i = 0; i < 10; i++) {
          await contract.connect(owner).addInvestor(addrs[i].address)
          await contract.connect(addrs[i]).invest({ value: investment }); // 1,500 Ether
        }

        expect(await contract.connect(owner).paused()).to.be.true;
        await expect(contract.invest({ value: parseEther("100") })).to.be
          .reverted;
      });
    });

    describe('General Phase', function () {
      beforeEach(async function () {
        const investment = parseEther("1500")

        for (let i = 0; i < 10; i++) {
          await contract.connect(owner).addInvestor(addrs[i].address)
          await contract.connect(addrs[i]).invest({ value: investment }); // 1,500 Ether
        }
        
        await contract.transitionPhaseForward()
      });

      it('Should let anyone invest during', async function () {
        const investment = parseEther("1000")
        const currentBalance = await contract.getBalance()

        await contract.invest({ value: investment })

        expect(await contract.getBalance()).to.equal(currentBalance.add(investment))
      });

      it('Should limit individual contributions to 1000 Ether', async function () {
        await expect(
          contract.invest({ value: parseEther("1001") })
        ).to.be.reverted;
      });

      it('Should pause funding when the 30,000 Ether goal is met', async function () {
        const investment = parseEther("1000")

        for (let i = 0; i < 15; i++) {
          await contract.connect(owner).addInvestor(addrs[i].address)
          await contract.connect(addrs[i]).invest({ value: investment }); // 1,500 Ether
        }

        expect(await contract.connect(owner).paused()).to.be.true;
        await expect(contract.invest({ value: parseEther("100") })).to.be
          .reverted;
      });
    });

    describe('Open Phase', function () {
      beforeEach(async function () {
        await contract.transitionPhaseForward(); // General
        await contract.transitionPhaseForward(); // Open
      });

     it('Should not limit individual contributions', async function () {
        await expect(contract.invest({value: parseEther("2000")})).to.not.be.reverted;
     });
    });
  });

  describe('Token Release', function () {
    it('Should prevent claiming tokens before the Open Phase', async function () {
      await contract.addInvestor(addr1.address)
      await contract.connect(addr1).invest({ value: parseEther("100") })
      await expect(contract.connect(addr1).withdraw()).to.be.reverted
    });

    // At that point, the ICO contract should immediately release ERC20-compatible
    // tokens for all contributors at an exchange rate of 5 tokens to 1 Ether.
    describe('Space Token', function () {
      const investments = [parseEther("100"), parseEther("10"), parseEther("50")]

      beforeEach(async function () {

        // First investor in the Seed phase
        await contract.addInvestor(addr1.address)
        await contract.connect(addr1).invest({ value: investments[0] })

        // Transition to General Phase
        await contract.transitionPhaseForward()

        // Investor in General Phase
        await contract.connect(addr2).invest({ value: investments[1] })

        // Transition to Open Phase
        await contract.transitionPhaseForward()

        // add 15 more investors
        for (let i = 0; i < 15; i++) {
          await contract.connect(owner).addInvestor(addrs[i].address)
          await contract.connect(addrs[i]).invest({ value: investments[2] });
        }
      });

      it('Should require that the withdrawer was an investor', async function () {
        // owner did not invest in beforeEach
        await expect(contract.withdraw()).to.be.reverted
      });

      it('Should let a contributor claim their tokens at 5 $SPACE per Eth', async function () {
        const investedEther = formatEther(await investments[0]) * 1;
        const expectedSpaceToken = investedEther * 5
        // Should be 0
        const startingBalance = await spaceToken.balanceOf(addr1.address);
        expect(startingBalance).to.equal(0);

        // Withdraw Contribution
        await contract.connect(addr1).withdraw();

        // Should be 5x investment
        const endingBalance = await spaceToken.balanceOf(addr1.address);
        expect(endingBalance).to.equal(expectedSpaceToken);

        // const addr1Contribution = await contract.connect(addr1).getContribution(addr1.address)
        // console.log(formatEther(await addr1Contribution.toString()))

        // console.log(balance.toString());

        // await expect(contract.connect(addr1).withdraw())
          // .to.changeTokenBalance(spaceToken, addr1)
        // await expect(contract.connect(addr1).withdraw())
        //   .to.changeTokenBalance(token, walletTo, 200);
      });

    });
  });
});
