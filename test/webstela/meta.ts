import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy, SignerWithAddress} from "./common/helper";

describe("token meta", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  const hashed = ethers.utils
    .hexlify(
      ethers.utils.sha256(ethers.utils.toUtf8Bytes("valid", "NFC" as any))
    )
    .padEnd(66, "0");

  beforeEach(async () => {
    subject = await deploy();
  });

  describe("valueOf", () => {
    let alice: SignerWithAddress;
    const tokenId = 1;
    const emptyBytes32 = ethers.utils.formatBytes32String("");
    const fooBytes32 = ethers.utils.formatBytes32String("foo");
    const barBytes32 = ethers.utils.formatBytes32String("bar");

    beforeEach(async () => {
      alice = subject.users[0];
      await subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        subject.contractOwner.address,
        alice.address,
        0,
        0
      );
    });

    it("should work", async () => {
      expect(
        await subject.instance["valueOf(uint256,bytes32)"](tokenId, fooBytes32)
      ).equals(emptyBytes32);
      expect(
        await subject.instance["valueOf(bytes32,bytes32)"](hashed, fooBytes32)
      ).equals(emptyBytes32);
      await subject.instance
        .connect(alice)
        .setTokenMeta(tokenId, [fooBytes32], [barBytes32]);
      expect(
        await subject.instance["valueOf(uint256,bytes32)"](tokenId, fooBytes32)
      ).equals(barBytes32);
      expect(
        await subject.instance["valueOf(bytes32,bytes32)"](hashed, fooBytes32)
      ).equals(barBytes32);
    });
  });

  describe("setTokenMeta", () => {
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    const tokenId = 1;
    const emptyBytes32 = ethers.utils.formatBytes32String("");
    const fooBytes32 = ethers.utils.formatBytes32String("foo");
    const barBytes32 = ethers.utils.formatBytes32String("bar");
    const bazBytes32 = ethers.utils.formatBytes32String("baz");
    const quxBytes32 = ethers.utils.formatBytes32String("qux");

    beforeEach(async () => {
      alice = subject.users[0];
      bob = subject.users[1];
      await subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        subject.contractOwner.address,
        alice.address,
        0,
        0
      );
    });

    it("should work with events", async () => {
      expect(
        await subject.instance["valueOf(bytes32,bytes32)"](hashed, fooBytes32)
      ).equals(emptyBytes32);
      expect(
        await subject.instance["valueOf(bytes32,bytes32)"](hashed, barBytes32)
      ).equals(emptyBytes32);
      await expect(
        subject.instance
          .connect(alice)
          .setTokenMeta(
            tokenId,
            [fooBytes32, barBytes32],
            [bazBytes32, quxBytes32]
          )
      )
        .emit(subject.instance, "TokenMeta")
        .withArgs(tokenId, [fooBytes32, barBytes32], [bazBytes32, quxBytes32]);
      expect(
        await subject.instance["valueOf(bytes32,bytes32)"](hashed, fooBytes32)
      ).equals(bazBytes32);
      expect(
        await subject.instance["valueOf(bytes32,bytes32)"](hashed, barBytes32)
      ).equals(quxBytes32);
    });

    it("should work with owner", async () => {
      await subject.instance.connect(alice).setTokenMeta(tokenId, [], []);
    });

    it("should revert with approved all", async () => {
      await subject.instance
        .connect(alice)
        .setApprovalForAll(bob.address, true);
      await expect(
        subject.instance.connect(bob).setTokenMeta(tokenId, [], [])
      ).to.be.revertedWith("caller is not the token owner");
    });

    it("should revert with approved on token", async () => {
      await subject.instance.connect(alice).approve(bob.address, tokenId);
      await expect(
        subject.instance.connect(bob).setTokenMeta(tokenId, [], [])
      ).to.be.revertedWith("caller is not the token owner");
    });

    it("should revert without owner or approved", async () => {
      await expect(
        subject.instance.connect(subject.users[1]).setTokenMeta(tokenId, [], [])
      ).to.be.revertedWith("caller is not the token owner");
    });

    it("should revert with invalid key value pairs", async () => {
      await expect(
        subject.instance
          .connect(alice)
          .setTokenMeta(tokenId, [fooBytes32, barBytes32], [bazBytes32])
      ).to.be.revertedWith("invalid key value pairs");
    });
  });
});
