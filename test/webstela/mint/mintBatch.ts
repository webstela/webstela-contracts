import {expect} from "chai";
import {ethers} from "hardhat";

import {
  assertEvents,
  deploy,
  currentTimestampInSeconds,
  sign,
  BigNumber,
  SignerWithAddress,
} from "../common/helper";

describe("mintBatch", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let onOwner: SignerWithAddress;
  let creator: SignerWithAddress;
  let owner: SignerWithAddress;
  let signature: string;
  let hashes: string[];
  let on: string;
  let price: BigNumber;
  let nextPrices: BigNumber[];
  let discount: BigNumber;
  let timeout: number;

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

    timeout = currentTimestampInSeconds() + 600;

    await subject.instance.mintByManager(
      on,
      ethers.constants.HashZero,
      onOwner.address,
      onOwner.address,
      0,
      0
    );

    price = ethers.utils.parseEther("0.01");
    nextPrices = [
      ethers.utils.parseEther("0.02"),
      ethers.utils.parseEther("0.03"),
      ethers.utils.parseEther("0.04"),
    ];
    discount = ethers.utils.parseEther("0");
    signature = await sign({
      manager: subject.manager,
      hashed: ethers.utils.concat(hashes),
      on,
      creator: creator.address,
      to: owner,
      price,
      discount,
      timeout,
    });
  });

  it("should send on ethers to contract when on is empty", async () => {
    const expectedTokenID = 2;
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      creator: await ethers.provider.getBalance(creator.address),
    };
    const on = ethers.constants.HashZero;
    const tx = subject.instance.connect(owner).mintBatch(
      hashes,
      on,
      creator.address,
      price,
      nextPrices,
      discount,
      timeout,
      await sign({
        manager: subject.manager,
        hashed: ethers.utils.concat(hashes),
        on,
        to: owner,
        creator: creator.address,
        price,
        discount,
        timeout,
      }),
      {
        value: price,
      }
    );

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

    expect(price).equals(ethers.utils.parseEther("0.01"));
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.contract.add(ethers.utils.parseEther("0.003"))
    );
    expect(await ethers.provider.getBalance(creator.address)).equals(
      balance.creator.add(ethers.utils.parseEther("0.007"))
    );
  });

  it("should work with premium token", async () => {
    const on = ethers.constants.HashZero;
    const price = ethers.utils.parseEther("1");
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
    };
    await subject.instance.connect(owner).mintBatch(
      hashes,
      on,
      owner.address,
      price,
      nextPrices,
      discount,
      timeout,
      await sign({
        manager: subject.manager,
        hashed: ethers.utils.concat(hashes),
        on,
        to: owner,
        creator: owner.address,
        price,
        discount,
        timeout,
      }),
      {
        value: price,
      }
    );
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.contract.add(ethers.utils.parseEther("1"))
    );
  });

  it("should work with discounted price for on", async () => {
    const discounted = ethers.utils.parseEther("0.002");
    const discountedSignature = await sign({
      manager: subject.manager,
      hashed: ethers.utils.concat(hashes),
      on,
      to: onOwner,
      creator: creator.address,
      price,
      discount: discounted,
      timeout,
    });
    const discountedPrice = ethers.utils.parseEther("0.008");

    await expect(
      subject.instance
        .connect(onOwner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: discountedPrice,
          }
        )
    ).revertedWith("not enough ethers");
    await expect(
      subject.instance
        .connect(onOwner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discounted,
          timeout,
          discountedSignature,
          {
            value: discountedPrice.sub(1),
          }
        )
    ).revertedWith("not enough ethers");
    await subject.instance
      .connect(onOwner)
      .mintBatch(
        hashes,
        on,
        creator.address,
        price,
        nextPrices,
        discounted,
        timeout,
        discountedSignature,
        {
          value: discountedPrice,
        }
      );
  });

  it("should work with discounted price for creator", async () => {
    const discounted = ethers.utils.parseEther("0.005");
    const discountedSignature = await sign({
      manager: subject.manager,
      hashed: ethers.utils.concat(hashes),
      on,
      to: creator,
      creator: creator.address,
      price,
      discount: discounted,
      timeout,
    });
    const discountedPrice = ethers.utils.parseEther("0.005");

    await expect(
      subject.instance
        .connect(creator)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: discountedPrice,
          }
        )
    ).revertedWith("not enough ethers");
    await expect(
      subject.instance
        .connect(creator)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discounted,
          timeout,
          discountedSignature,
          {
            value: discountedPrice.sub(1),
          }
        )
    ).revertedWith("not enough ethers");
    await subject.instance
      .connect(creator)
      .mintBatch(
        hashes,
        on,
        creator.address,
        price,
        nextPrices,
        discounted,
        timeout,
        discountedSignature,
        {
          value: discountedPrice,
        }
      );
  });

  it("should work with discounted price for on and by", async () => {
    const creator = onOwner;
    const discounted = ethers.utils.parseEther("0.009");
    const discountedSignature = await sign({
      manager: subject.manager,
      hashed: ethers.utils.concat(hashes),
      on,
      to: creator,
      creator: creator.address,
      price,
      discount: discounted,
      timeout,
    });
    const discountedPrice = ethers.utils.parseEther("0.001");

    await expect(
      subject.instance
        .connect(creator)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: discountedPrice,
          }
        )
    ).revertedWith("not enough ethers");
    await expect(
      subject.instance
        .connect(creator)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discounted,
          timeout,
          discountedSignature,
          {
            value: discountedPrice.sub(1),
          }
        )
    ).revertedWith("not enough ethers");
    await subject.instance
      .connect(creator)
      .mintBatch(
        hashes,
        on,
        creator.address,
        price,
        nextPrices,
        discounted,
        timeout,
        discountedSignature,
        {
          value: discountedPrice,
        }
      );
  });

  it("should revert with expired tx", async () => {
    const timeout = currentTimestampInSeconds() - 1;
    await expect(
      subject.instance.connect(owner).mintBatch(
        hashes,
        on,
        creator.address,
        price,
        nextPrices,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed: ethers.utils.concat(hashes),
          on,
          to: owner,
          creator: creator.address,
          price,
          discount,
          timeout,
        }),
        {
          value: price,
        }
      )
    ).revertedWith("timed out");
  });

  it("should revert with zero hashed", async () => {
    await expect(
      subject.instance.connect(owner).mintBatch(
        [ethers.constants.HashZero, hashes[0], hashes[1]],
        on,
        creator.address,
        price,
        nextPrices,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed: ethers.utils.concat([
            ethers.constants.HashZero,
            hashes[0],
            hashes[1],
          ]),
          on,
          to: owner,
          creator: creator.address,
          price,
          discount,
          timeout,
        }),
        {
          value: price,
        }
      )
    ).revertedWith("invalid hashed");
  });

  it("should distribute properly", async () => {
    const balances = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      onOwner: await onOwner.getBalance(),
      creator: await creator.getBalance(),
    };
    await subject.instance
      .connect(owner)
      .mintBatch(
        hashes,
        on,
        creator.address,
        price,
        nextPrices,
        discount,
        timeout,
        signature,
        {
          value: price,
        }
      );
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balances.contract.add(ethers.utils.parseEther("0.001"))
    );
    expect(await onOwner.getBalance()).equals(
      balances.onOwner.add(ethers.utils.parseEther("0.002"))
    );
    expect(await creator.getBalance()).equals(
      balances.creator.add(ethers.utils.parseEther("0.007"))
    );
  });

  it("should revert without enough ethers", async () => {
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price.sub(1),
          }
        )
    ).revertedWith("not enough ethers");
  });

  it("should revert without valid signature", async () => {
    await expect(
      subject.instance
        .connect(onOwner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).revertedWith("invalid signature");
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          [hashes[0], hashes[2], hashes[1]],
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).revertedWith("invalid signature");
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          hashes,
          hashes[0],
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).revertedWith("invalid signature");
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          hashes,
          on,
          onOwner.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).revertedWith("invalid signature");
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price.sub(1),
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).revertedWith("invalid signature");
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount.add(1),
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).revertedWith("invalid signature");
    await expect(
      subject.instance
        .connect(owner)
        .mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          currentTimestampInSeconds() + 601,
          signature,
          {
            value: price.mul(2),
          }
        )
    ).revertedWith("invalid signature");
  });

  it("should revert without creator", async () => {
    await expect(
      subject.instance.connect(owner).mintBatch(
        hashes,
        on,
        ethers.constants.AddressZero,
        price,
        nextPrices,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed: ethers.utils.concat(hashes),
          on,
          to: owner,
          creator: ethers.constants.AddressZero,
          price,
          discount,
          timeout,
        }),
        {
          value: price,
        }
      )
    ).revertedWith("invalid token creator");
  });

  it("estimate gas", async () => {
    expect(
      await subject.instance
        .connect(owner)
        .estimateGas.mintBatch(
          hashes,
          on,
          creator.address,
          price,
          nextPrices,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).closeTo(210000 + 88_000 * 3, 15_000);
  });
});
