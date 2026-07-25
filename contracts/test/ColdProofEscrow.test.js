import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("ColdProofEscrow", function () {
  async function fixture() {
    const [owner, oracle, payer, payee, stranger] =
      await ethers.getSigners();
    const escrow = await ethers.deployContract("ColdProofEscrow", [
      oracle.address,
    ]);
    const deliveryId = ethers.id("delivery-1");
    const deviceIdHash = ethers.id("device-1");
    const deadline =
      (await ethers.provider.getBlock("latest")).timestamp + 3600;
    return {
      escrow,
      owner,
      oracle,
      payer,
      payee,
      stranger,
      deliveryId,
      deviceIdHash,
      deadline,
    };
  }

  async function funded() {
    const f = await fixture();
    await f.escrow.connect(f.payer).fundDelivery(
      f.deliveryId,
      f.payee.address,
      f.deviceIdHash,
      2000,
      8000,
      2,
      f.deadline,
      { value: ethers.parseEther("1") }
    );
    return f;
  }

  it("releases escrow after the required compliant readings", async function () {
    const f = await funded();
    await f.escrow.connect(f.payer).startDelivery(f.deliveryId);
    await f.escrow
      .connect(f.oracle)
      .recordReading(f.deliveryId, 1, 4500, 1, ethers.id("reading-1"));
    await f.escrow
      .connect(f.oracle)
      .recordReading(f.deliveryId, 2, 5000, 2, ethers.id("reading-2"));

    await expect(() =>
      f.escrow.connect(f.oracle).release(f.deliveryId)
    ).to.changeEtherBalances(
      [f.escrow, f.payee],
      [-ethers.parseEther("1"), ethers.parseEther("1")]
    );
    expect((await f.escrow.deliveries(f.deliveryId)).status).to.equal(3);
  });

  it("refunds the payer when a reading violates the range", async function () {
    const f = await funded();
    await f.escrow.connect(f.payer).startDelivery(f.deliveryId);
    await f.escrow
      .connect(f.oracle)
      .recordReading(f.deliveryId, 1, 9000, 1, ethers.id("bad-reading"));

    await expect(() =>
      f.escrow.connect(f.oracle).refund(f.deliveryId)
    ).to.changeEtherBalances(
      [f.escrow, f.payer],
      [-ethers.parseEther("1"), ethers.parseEther("1")]
    );
    expect((await f.escrow.deliveries(f.deliveryId)).status).to.equal(4);
  });

  it("rejects duplicate sequences and unauthorized readings", async function () {
    const f = await funded();
    await f.escrow.connect(f.payer).startDelivery(f.deliveryId);
    const args = [f.deliveryId, 1, 4500, 1, ethers.id("reading")];

    await expect(
      f.escrow.connect(f.stranger).recordReading(...args)
    ).to.be.revertedWithCustomError(f.escrow, "Unauthorized");
    await f.escrow.connect(f.oracle).recordReading(...args);
    await expect(
      f.escrow.connect(f.oracle).recordReading(...args)
    ).to.be.revertedWithCustomError(f.escrow, "DuplicateSequence");
  });
});
