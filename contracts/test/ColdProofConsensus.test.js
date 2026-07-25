import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("ColdProofConsensus", function () {
  it("only lets the oracle append ordered readings", async function () {
    const [owner, oracle, stranger] = await ethers.getSigners();
    const contract = await ethers.deployContract("ColdProofConsensus", [
      oracle.address,
    ]);
    await contract.waitForDeployment();

    await expect(
      contract
        .connect(stranger)
        .recordReading("box-1", 1, 4250, "C", 100, "pk", "sig", 100000, ethers.id("r"))
    ).to.be.revertedWithCustomError(contract, "Unauthorized");

    await expect(
      contract
        .connect(oracle)
        .recordReading("box-1", 1, 4250, "C", 100, "pk", "sig", 100000, ethers.id("r"))
    ).to.emit(contract, "ReadingRecorded");

    expect(await contract.sequence()).to.equal(1);
  });
});
