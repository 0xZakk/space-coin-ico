const hre = require("hardhat");
const { ethers, waffle } = require("hardhat");
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { parseEther, formatEther, parseUnits } = require("ethers/lib/utils");
const { expandTo18Decimals, sqrt } = require("./utils");
const { BigNumber } = ethers;
const BN = BigNumber;

chai.use(solidity);

const { expect } = chai;

const MINIMUM_LIQUIDITY = BN.from(10).pow(3);
const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("Liquidty Pool", function () {
  let provider = waffle.provider;

  let LiquidityPoolContract;
  let TokenContract;
  let ICOContract;

  let lpContract;
  let spaceToken;
  let icoContract;

  let treasury;
  let addrs;

  async function addLiquidity(signer, eth, spc) {
    await spaceToken.connect(signer).approve(lpContract.address, spc);
    await lpContract.mint(signer.address, eth, spc, { value: eth });
  }

  function calculateLiquidity(eth, spc) {
    return sqrt(eth.mul(spc));
  }

  beforeEach(async function () {
    // provider = ethers.getDefaultProvider();
    // Set up some wallets
    addrs = await ethers.getSigners();
    treasury = addrs.shift();

    // First get all the contracts
    LiquidityPoolContract = await ethers.getContractFactory(
      "LiquidityPool",
      treasury
    );
    TokenContract = await ethers.getContractFactory("SpaceToken", treasury);
    ICOContract = await ethers.getContractFactory("SpaceTokenICO", treasury);

    // Deploy the ICO first
    icoContract = await ICOContract.deploy();
    await icoContract.deployed();
    await icoContract.deployed();

    // Deploy the token
    spaceToken = await TokenContract.deploy(
      treasury.address,
      icoContract.address
    );
    await spaceToken.deployed();
    await spaceToken.deployed();
    icoContract.setTokenAddress(spaceToken.address);

    // Finally deploy the Liquidity Pool
    lpContract = await LiquidityPoolContract.deploy(spaceToken.address);

    await lpContract.deployed();
    await lpContract.deployed();
  });

  describe("Deployment", function () {
    it("Should set the correct owner for the contracts", async function () {
      expect(await lpContract.owner()).to.equal(treasury.address);
      expect(await spaceToken.owner()).to.equal(treasury.address);
      expect(await icoContract.owner()).to.equal(treasury.address);
    });

    it("Should set the token address to the SpaceToken address", async function () {
      expect(await lpContract.tokenAddress()).to.equal(spaceToken.address);
    });
  });

  describe("Mint", function () {
    it("mint", async function () {
      // Amounts to transfer at 1:5 ratio
      const amountEth = expandTo18Decimals(100); // 100 Ether
      const amountSpc = expandTo18Decimals(500); // 500 Space

      // Transfer Eth + Spc to the LP Pool
      await spaceToken.approve(lpContract.address, amountSpc);

      // expected LP tokens to get back
      const expectedLiquidity = calculateLiquidity(amountEth, amountSpc);

      // mint
      await expect(
        lpContract.mint(treasury.address, amountEth, amountSpc, {
          value: amountEth,
        })
      )
        // Should first burn the minimum liquiduty and emit a transfer event
        .to.emit(lpContract, "Transfer")
        .withArgs(ZERO_ADDRESS, ZERO_ADDRESS, MINIMUM_LIQUIDITY)
        // Should emit the transfer event to the treasury wallet, adding liquidity
        .to.emit(lpContract, "Transfer")
        .withArgs(
          ZERO_ADDRESS,
          treasury.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY)
        )
        // Should emit Sync between the two tokens, Eth and SPC
        // .to.emit(lpContract, 'Sync')
        // .withArgs(amountEth, amountSpc)
        // Should emit Mint with wallet address and amounts
        .to.emit(lpContract, "Mint")
        .withArgs(treasury.address, amountEth, amountSpc);

      // The total supply should equal the initial liquidity
      expect(await lpContract.totalSupply()).to.equal(expectedLiquidity);

      // The treasury's balance of LP tokens should equal the amount
      // of liquidity provided, minus the burnt minimum
      expect(await lpContract.balanceOf(treasury.address)).to.equal(
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      );

      // The balance of the pool should equal the amount sent in by
      // the treasury for both Eth and $SPC
      expect(await provider.getBalance(lpContract.address)).to.equal(amountEth);
      expect(await spaceToken.balanceOf(lpContract.address)).to.equal(
        amountSpc
      );

      // the reserves amount should be in sync with the token balances above
      // i.e. reserve0 should equal the lpContract's balance of eth and
      // reserve1 should equal the $SPC token balance
      const reserves = await lpContract.getReserves();
      expect(reserves[0]).to.equal(amountEth);
      expect(reserves[1]).to.equal(amountSpc);
    });

    // TODO: Test multiple people adding liquidity

    it("Should require Eth amount and Eth sent are equal", async function () {
      const amountEth = expandTo18Decimals(500); // 500 Ether
      const amountSpc = expandTo18Decimals(100); // 100 Space

      await spaceToken.approve(lpContract.address, amountSpc);

      await expect(
        lpContract.mint(treasury.address, amountEth.mul(2), amountSpc, {
          value: amountEth,
        })
      ).to.be.revertedWith("Eth value mismatch");
    });

    it("Should ensure the token allowance is big enough for the initial liquidity", async function () {
      const amountEth = expandTo18Decimals(500); // 500 Ether
      const amountSpc = expandTo18Decimals(100); // 100 Space

      await spaceToken.approve(lpContract.address, amountSpc.div(2));

      await expect(
        lpContract.mint(treasury.address, amountEth, amountSpc, {
          value: amountEth,
        })
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });
  });

  describe("Burn", function () {
    it("burns", async function () {
      // provide equal liquidity so math is easier below
      const amountEth = expandTo18Decimals(100);
      const amountSpc = expandTo18Decimals(100);

      // expected LP tokens to get back
      const expectedLiquidity = calculateLiquidity(amountEth, amountSpc);

      // Add liquidity
      await addLiquidity(treasury, amountEth, amountSpc);

      // LP Tokens
      const lpTokens = await lpContract.balanceOf(treasury.address);
      const totalSupply = await lpContract.totalSupply();

      // burn
      await expect(lpContract.burn(lpTokens))
        // Should transfer LP tokens from provider to pool
        .to.emit(lpContract, "Transfer")
        .withArgs(
          treasury.address,
          lpContract.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY)
        )
        // Should Transfer LP tokens to address(0) (i.e. burn them)
        .to.emit(lpContract, "Transfer")
        .withArgs(
          lpContract.address,
          ZERO_ADDRESS,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY)
        )
        // Transfer $spc from pool to provider, minus fee
        .to.emit(spaceToken, "Transfer")
        .withArgs(lpContract.address, treasury.address, amountSpc.sub(1000))
        // Transfer eth from pool to provider, minus fee
        .to.emit(lpContract, "Transfer")
        .withArgs(treasury.address, lpContract.address, amountEth.sub(1000))
        // // Sync token reserves with balance
        // .to.emit(lpContract.address, 'Sync')
        // .withArgs(1000, 1000)
        // burn fees??
        .to.emit(lpContract, "Burn")
        .withArgs(
          treasury.address,
          amountEth.sub(1000),
          amountSpc.sub(1000),
          treasury.address
        );

      expect(await lpContract.balanceOf(treasury.address)).to.equal(0);
      expect(await lpContract.totalSupply()).to.equal(MINIMUM_LIQUIDITY);
      expect(await spaceToken.balanceOf(lpContract.address)).to.equal(1000);
      expect(await provider.getBalance(lpContract.address)).to.equal(1000);
    });

    it("Should prevent burning with more than your balance of lp tokens", async function () {
      // Amounts to transfer at 1:5 ratio
      const amountEth = expandTo18Decimals(100); // 100 Ether
      const amountSpc = expandTo18Decimals(500); // 500 Space

      // expected LP tokens to get back
      const expectedLiquidity = calculateLiquidity(amountEth, amountSpc);

      // Add liquidity
      await addLiquidity(treasury, amountEth, amountSpc);

      // Get LP token balance
      const balance = await lpContract.balanceOf(treasury.address);

      // burn
      await expect(lpContract.burn(balance.mul(2))).to.be.revertedWith(
        "Not enough LP tokens"
      );
    });
  });

  describe("Swap", function () {
    let swapper;
    const liquidEth = expandTo18Decimals(100);
    const liquidSpc = expandTo18Decimals(500);
    const spaceBudget = expandTo18Decimals(50);
    let ethBudget;

    beforeEach(async function () {
      await addLiquidity(treasury, liquidEth, liquidSpc);

      swapper = await ethers.getSigner();

      await spaceToken.transfer(swapper.address, spaceBudget.mul(2));
      ethBudget = await provider.getBalance(swapper.address)

      // console.log("before a swap test")
      // console.log(`swapper Eth balance: ${await provider.getBalance(swapper.address)}`)
      // console.log(`swapper $SPC balance: ${await spaceToken.balanceOf(swapper.address)}`)
    });

    describe("$SPC for Eth", function () {
      // TODO: test for insufficient liquidity

      it("Should emit a Transfer event", async function () {
        const spaceIn = expandTo18Decimals(5);
        // give lpContract an allowance of space
        await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

        await expect(lpContract.connect(swapper).swapSpaceForEth(spaceIn))
          // Should emit a transfer event, because we're transfering
          // $SPC from swapper to the pool
          .to.emit(spaceToken, "Transfer")
          .withArgs(swapper.address, lpContract.address, spaceIn);
      });

      it("Should emit a sync", async function () {
        const spaceIn = expandTo18Decimals(5);
        // give lpContract an allowance of space
        await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

        await expect(lpContract.connect(swapper).swapSpaceForEth(spaceIn))
          // Should emit a transfer event, because we're transfering
          // $SPC from swapper to the pool
          .to.emit(lpContract, "Sync")
          .withArgs(liquidEth.sub(spaceIn.mul(5)), liquidSpc.add(spaceIn));
      });

      it("Should send Eth to the swapper, removing it form the pool", async function () {
        const spaceIn = expandTo18Decimals(5);
        const expectedEth = expandTo18Decimals(25);
        // give lpContract an allowance of space
        await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

        await expect(
          await lpContract.connect(swapper).swapSpaceForEth(spaceIn)
        ).to.changeEtherBalances(
          [swapper, lpContract],
          [expectedEth, expectedEth.mul(-1)]
        );
      });

      it("Should add $SPC to the pool, removing it form the swapper", async function () {
        const spaceIn = expandTo18Decimals(5);
        await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

        const swapperStartingBalance = await spaceToken.balanceOf(
          swapper.address
        );
        const poolStartingBalance = await spaceToken.balanceOf(
          lpContract.address
        );

        await lpContract.connect(swapper).swapSpaceForEth(spaceIn);

        // swapper $SPC balance should decrease by spaceIn
        expect(await spaceToken.balanceOf(swapper.address)).to.equal(
          swapperStartingBalance.sub(spaceIn)
        );

        // lpContract $SPC balance should increase by spaceIn
        expect(await spaceToken.balanceOf(lpContract.address)).to.equal(
          poolStartingBalance.add(spaceIn)
        );
      });

      it("Should update the pool's balances", async function () {
        const spaceIn = expandTo18Decimals(5);
        const expectedEth = expandTo18Decimals(25);

        const originalReserves = await lpContract.getReserves();

        await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);
        await lpContract.connect(swapper).swapSpaceForEth(spaceIn);

        const updatedReserves = await lpContract.getReserves();

        expect(updatedReserves[0]).to.equal(
          originalReserves[0].sub(expectedEth)
        );
        expect(updatedReserves[1]).to.equal(originalReserves[1].add(spaceIn));
      });
    });

    describe("Eth for $SPC", function () {
      it("Should emit a Transfer event", async function () {
        // transfer $SPC from the pool to the swapper
        const ethIn = expandTo18Decimals(25);

        await expect(lpContract.connect(swapper).swapEthforSpace({ value: ethIn }))
          .to.emit(spaceToken, "Transfer")
          .withArgs(swapper.address, lpContract.address, ethIn.div(5));
      });

      // it("Should emit a sync", async function () {
      //   const spaceIn = expandTo18Decimals(5);
      //   // give lpContract an allowance of space
      //   await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

      //   await expect(lpContract.connect(swapper).swapSpaceForEth(spaceIn))
      //     // Should emit a transfer event, because we're transfering
      //     // $SPC from swapper to the pool
      //     .to.emit(lpContract, "Sync")
      //     .withArgs(liquidEth.sub(spaceIn.mul(5)), liquidSpc.add(spaceIn));
      // });

      // it("Should send $SPC to the swapper, removing it form the pool", async function () {
      //   const spaceIn = expandTo18Decimals(5);
      //   const expectedEth = expandTo18Decimals(25);
      //   // give lpContract an allowance of space
      //   await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

      //   await expect(
      //     await lpContract.connect(swapper).swapSpaceForEth(spaceIn)
      //   ).to.changeEtherBalances(
      //     [swapper, lpContract],
      //     [expectedEth, expectedEth.mul(-1)]
      //   );
      // });

      // it("Should add Eth to the pool, removing it form the swapper", async function () {
      //   const spaceIn = expandTo18Decimals(5);
      //   await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);

      //   const swapperStartingBalance = await spaceToken.balanceOf(
      //     swapper.address
      //   );
      //   const poolStartingBalance = await spaceToken.balanceOf(
      //     lpContract.address
      //   );

      //   await lpContract.connect(swapper).swapSpaceForEth(spaceIn);

      //   // swapper $SPC balance should decrease by spaceIn
      //   expect(await spaceToken.balanceOf(swapper.address)).to.equal(
      //     swapperStartingBalance.sub(spaceIn)
      //   );

      //   // lpContract $SPC balance should increase by spaceIn
      //   expect(await spaceToken.balanceOf(lpContract.address)).to.equal(
      //     poolStartingBalance.add(spaceIn)
      //   );
      // });

      // it("Should update the pool's balances", async function () {
      //   const spaceIn = expandTo18Decimals(5);
      //   const expectedEth = expandTo18Decimals(25);

      //   const originalReserves = await lpContract.getReserves();

      //   await spaceToken.connect(swapper).approve(lpContract.address, spaceIn);
      //   await lpContract.connect(swapper).swapSpaceForEth(spaceIn);

      //   const updatedReserves = await lpContract.getReserves();

      //   expect(updatedReserves[0]).to.equal(
      //     originalReserves[0].sub(expectedEth)
      //   );
      //   expect(updatedReserves[1]).to.equal(originalReserves[1].add(spaceIn));
      // });
    });
  });
});
