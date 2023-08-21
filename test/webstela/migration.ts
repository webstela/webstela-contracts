import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy, SignerWithAddress} from "./common/helper";

describe("migrateAccount", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  beforeEach(async () => {
    subject = await deploy();

    alice = subject.users[0];
    bob = subject.users[1];
    carol = subject.users[2];

    let hashed: string;

    hashed = ethers.utils.sha256(ethers.utils.toUtf8Bytes("foo", "NFC" as any));
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      alice.address,
      alice.address,
      0,
      ethers.utils.parseEther("0.02")
    );

    hashed = ethers.utils.sha256(ethers.utils.toUtf8Bytes("bar", "NFC" as any));
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      bob.address,
      alice.address,
      0,
      ethers.utils.parseEther("0.02")
    );

    hashed = ethers.utils.sha256(ethers.utils.toUtf8Bytes("baz", "NFC" as any));
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      bob.address,
      bob.address,
      0,
      ethers.utils.parseEther("0.02")
    );

    hashed = ethers.utils.sha256(ethers.utils.toUtf8Bytes("qux", "NFC" as any));
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      alice.address,
      bob.address,
      0,
      ethers.utils.parseEther("0.02")
    );

    await subject.instance
      .connect(alice)
      .setTokenNamespace(1, ethers.utils.toUtf8Bytes("foo", "NFC" as any));

    await subject.instance.connect(alice).setAccountName(1);
  });

  it("should work with valid event log", async () => {
    const tx = subject.instance
      .connect(alice)
      .migrateAccount(carol.address, [1, 2, 3, 4]);
    await expect(tx)
      .emit(subject.instance, "Transfer")
      .withArgs(alice.address, carol.address, 1)
      .emit(subject.instance, "Transfer")
      .withArgs(alice.address, carol.address, 2)
      .emit(subject.instance, "TokenRoyaltyHolder")
      .withArgs(1, carol.address)
      .emit(subject.instance, "TokenRoyaltyHolder")
      .withArgs(4, carol.address);
    expect(await subject.instance["ownerOf(uint256)"](1)).equals(carol.address);
    expect(await subject.instance["ownerOf(uint256)"](2)).equals(carol.address);
    expect(await subject.instance["ownerOf(uint256)"](3)).equals(bob.address);
    expect(await subject.instance["ownerOf(uint256)"](4)).equals(bob.address);
    expect(await subject.instance.royaltyHolderOf(1)).equals(carol.address);
    expect(await subject.instance.royaltyHolderOf(2)).equals(bob.address);
    expect(await subject.instance.royaltyHolderOf(3)).equals(bob.address);
    expect(await subject.instance.royaltyHolderOf(4)).equals(carol.address);
    expect(await subject.instance.balanceOf(alice.address)).equals(0);
    expect(await subject.instance.balanceOf(bob.address)).equals(2);
    expect(await subject.instance.balanceOf(carol.address)).equals(2);
  });

  it("should work for royalty holder only", async () => {
    const tx = subject.instance
      .connect(alice)
      .migrateAccount(carol.address, [4]);
    await expect(tx)
      .emit(subject.instance, "TokenRoyaltyHolder")
      .withArgs(4, carol.address);
    expect(await subject.instance["ownerOf(uint256)"](4)).equals(bob.address);
    expect(await subject.instance.royaltyHolderOf(4)).equals(carol.address);
    expect(await subject.instance.balanceOf(alice.address)).equals(2);
    expect(await subject.instance.balanceOf(bob.address)).equals(2);
    expect(await subject.instance.balanceOf(carol.address)).equals(0);
  });
});
