import {expect} from "chai";
import {ethers} from "hardhat";

import {
  assertEvents,
  deploy,
  BigNumber,
  SignerWithAddress,
} from "../common/helper";

describe("mintBatchByManager", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let onOwner: SignerWithAddress;
  let creator: SignerWithAddress;
  let owner: SignerWithAddress;
  let hashes: string[];
  let on: string;
  let price: BigNumber;
  let nextPrices: BigNumber[];

  beforeEach(async () => {
    subject = await deploy();
    onOwner = subject.users[0];
    creator = subject.users[1];
    owner = subject.users[2];

    on = ethers.utils.sha256(ethers.utils.toUtf8Bytes("foo", "NFC" as any));
    hashes = [
      ethers.utils.sha256(ethers.utils.toUtf8Bytes("bar", "NFC" as any)),
      ethers.utils.sha256(ethers.utils.toUtf8Bytes("baz", "NFC" as any)),
      ethers.utils.sha256(ethers.utils.toUtf8Bytes("qux", "NFC" as any)),
    ];
    price = ethers.utils.parseEther("0");
    nextPrices = [
      ethers.utils.parseEther("0.02"),
      ethers.utils.parseEther("0.03"),
      ethers.utils.parseEther("0.04"),
    ];

    await subject.instance.mintByManager(
      on,
      ethers.constants.HashZero,
      onOwner.address,
      onOwner.address,
      0,
      0
    );
  });

  it("should work with valid event log", async () => {
    const tx = subject.instance.mintBatchByManager(
      hashes,
      on,
      creator.address,
      owner.address,
      price,
      nextPrices
    );

    const expectedTokenID = 2;
    await assertEvents(
      subject.instance,
      tx,
      hashes.reduce((acc, hashed, idx) => {
        const tokenID = expectedTokenID + idx;
        return acc.concat([
          ["Mint", [tokenID, hashed, on]],
          ["TokenRoyaltyHolder", [tokenID, creator.address]],
          ["TokenPrice", [tokenID, price]],
          ["Buy", [expectedTokenID, price]],
          ["Transfer", [ethers.constants.AddressZero, owner.address, tokenID]],
          ["TokenPrice", [tokenID, nextPrices[idx]]],
        ] as any);
      }, [])
    );

    expect(await subject.instance.royaltyHolderOf(2)).equals(creator.address);
    expect(await subject.instance["ownerOf(uint256)"](2)).equals(owner.address);
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
        .mintBatchByManager(
          hashes,
          on,
          ethers.constants.AddressZero,
          owner.address,
          price,
          nextPrices
        )
    ).revertedWith("caller is not the manager");
  });

  it("should revert with invalid next prices", async () => {
    await expect(
      subject.instance.mintBatchByManager(
        hashes,
        on,
        creator.address,
        owner.address,
        price,
        [nextPrices[0], nextPrices[1]]
      )
    ).revertedWith("invalid next prices");
  });

  it("should revert with zero address", async () => {
    await expect(
      subject.instance.mintBatchByManager(
        hashes,
        on,
        ethers.constants.AddressZero,
        owner.address,
        price,
        nextPrices
      )
    ).revertedWith("invalid token creator");
    await expect(
      subject.instance.mintBatchByManager(
        hashes,
        on,
        creator.address,
        ethers.constants.AddressZero,
        price,
        nextPrices
      )
    ).revertedWith("invalid token owner");
  });

  it("should increase totalSupply by 3", async () => {
    const totalSupply = await subject.instance.totalSupply();
    await subject.instance.mintBatchByManager(
      hashes,
      on,
      creator.address,
      owner.address,
      price,
      nextPrices
    );
    expect(await subject.instance.totalSupply()).equals(totalSupply.add(3));
  });

  it("should increase balanceOf by 3", async () => {
    const balanceOf = await subject.instance.balanceOf(owner.address);
    await subject.instance.mintBatchByManager(
      hashes,
      on,
      creator.address,
      owner.address,
      price,
      nextPrices
    );
    expect(await subject.instance.balanceOf(owner.address)).equals(
      balanceOf.add(3)
    );
  });

  it("should distribute properly", async () => {
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
    await subject.instance.mintBatchByManager(
      hashes,
      on,
      creator.address,
      owner.address,
      ethers.utils.parseEther("0.8"),
      nextPrices
    );
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balances.contract.sub(ethers.utils.parseEther("0.72"))
    );
    expect(await onOwner.getBalance()).equals(
      balances.onOwner.add(ethers.utils.parseEther("0.16"))
    );
    expect(await creator.getBalance()).equals(
      balances.creator.add(ethers.utils.parseEther("0.56"))
    );
    expect(await owner.getBalance()).equals(balances.owner);
  });

  it("estimate gas", async () => {
    expect(
      await subject.instance.estimateGas.mintBatchByManager(
        hashes,
        on,
        creator.address,
        owner.address,
        price,
        nextPrices
      )
    ).closeTo(170_000 + 90_000 * 3, 10_000);
  });
});
