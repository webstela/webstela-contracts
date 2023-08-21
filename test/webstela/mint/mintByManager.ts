import {expect} from "chai";
import {ethers} from "hardhat";

import {assertEvents, deploy, SignerWithAddress} from "../common/helper";

describe("mintByManager", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let creator: SignerWithAddress;
  let owner: SignerWithAddress;

  const hashed = ethers.utils
    .hexlify(
      ethers.utils.sha256(ethers.utils.toUtf8Bytes("valid", "NFC" as any))
    )
    .padEnd(66, "0");

  beforeEach(async () => {
    subject = await deploy();
    creator = subject.users[0];
    owner = subject.users[1];
  });

  it("should work with valid event log", async () => {
    const on = ethers.constants.HashZero;
    const expectedTokenID = 1;
    const expectedTokenPrice = ethers.utils.parseEther("0.1");

    const tx = subject.instance.mintByManager(
      hashed,
      on,
      creator.address,
      owner.address,
      0,
      expectedTokenPrice
    );

    await assertEvents(subject.instance, tx, [
      ["Mint", [expectedTokenID, hashed, on]],
      ["TokenRoyaltyHolder", [expectedTokenID, creator.address]],
      ["TokenPrice", [expectedTokenID, 0]],
      ["Buy", [expectedTokenID, 0]],
      [
        "Transfer",
        [ethers.constants.AddressZero, owner.address, expectedTokenID],
      ],
      ["TokenPrice", [expectedTokenID, expectedTokenPrice]],
    ]);

    expect(await subject.instance.royaltyHolderOf(expectedTokenID)).equals(
      creator.address
    );
    expect(await subject.instance["ownerOf(uint256)"](expectedTokenID)).equals(
      owner.address
    );
  });

  it("should revert with zero hashed", async () => {
    await expect(
      subject.instance.mintByManager(
        ethers.constants.HashZero,
        ethers.constants.HashZero,
        creator.address,
        owner.address,
        0,
        0
      )
    ).revertedWith("invalid hashed");
  });

  it("should revert without contract manager", async () => {
    await expect(
      subject.instance
        .connect(owner)
        .mintByManager(
          hashed,
          ethers.constants.HashZero,
          creator.address,
          owner.address,
          0,
          0
        )
    ).revertedWith("caller is not the manager");
  });

  it("should revert with zero address", async () => {
    await expect(
      subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        ethers.constants.AddressZero,
        owner.address,
        0,
        0
      )
    ).revertedWith("invalid token creator");
    await expect(
      subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        creator.address,
        ethers.constants.AddressZero,
        0,
        0
      )
    ).revertedWith("invalid token owner");
  });

  it("should revert with existing hashed", async () => {
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      creator.address,
      owner.address,
      0,
      0
    );

    await expect(
      subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        creator.address,
        owner.address,
        0,
        0
      )
    ).revertedWith("already exists");
  });

  it("should increase totalSupply by one", async () => {
    expect(await subject.instance.totalSupply()).equals(0);
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      creator.address,
      owner.address,
      0,
      0
    );
    expect(await subject.instance.totalSupply()).equals(1);
  });

  it("should increase balanceOf by one", async () => {
    expect(await subject.instance.balanceOf(owner.address)).equals(0);
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      creator.address,
      owner.address,
      0,
      0
    );
    expect(await subject.instance.balanceOf(owner.address)).equals(1);
  });

  it("should distribute properly", async () => {
    const onOwner = subject.users[9];
    await subject.contractOwner.sendTransaction({
      to: subject.instance.address,
      value: ethers.utils.parseEther("1"),
    });
    const balances = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      onOwner: await onOwner.getBalance(),
      creator: await creator.getBalance(),
      owner: await owner.getBalance(),
    };
    const on = ethers.utils
      .hexlify(
        ethers.utils.sha256(ethers.utils.toUtf8Bytes("on", "NFC" as any))
      )
      .padEnd(66, "0");
    await subject.instance.mintByManager(
      on,
      ethers.constants.HashZero,
      onOwner.address,
      onOwner.address,
      0,
      0
    );
    await subject.instance.mintByManager(
      hashed,
      on,
      creator.address,
      owner.address,
      ethers.utils.parseEther("1"),
      0
    );
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balances.contract.sub(ethers.utils.parseEther("0.9"))
    );
    expect(await onOwner.getBalance()).equals(
      balances.onOwner.add(ethers.utils.parseEther("0.2"))
    );
    expect(await creator.getBalance()).equals(
      balances.creator.add(ethers.utils.parseEther("0.7"))
    );
    expect(await owner.getBalance()).equals(balances.owner);
  });

  it("estimate gas", async () => {
    expect(
      await subject.instance.estimateGas.mintByManager(
        hashed,
        ethers.constants.HashZero,
        creator.address,
        owner.address,
        0,
        0
      )
    ).closeTo(170_000, 10_000);
  });
});
