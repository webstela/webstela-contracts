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

describe("mint", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let onOwner: SignerWithAddress;
  let creator: SignerWithAddress;
  let owner: SignerWithAddress;
  let signature: string;
  let hashed: string;
  let on: string;
  let price: BigNumber;
  let nextPrice: BigNumber;
  let discount: BigNumber;
  let timeout: number;

  beforeEach(async () => {
    subject = await deploy();

    onOwner = subject.users[0];
    creator = subject.users[1];
    owner = subject.users[2];

    on = ethers.utils.sha256(ethers.utils.toUtf8Bytes("foo", "NFC" as any));
    hashed = ethers.utils.sha256(ethers.utils.toUtf8Bytes("bar", "NFC" as any));

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
    nextPrice = ethers.utils.parseEther("0.02");
    discount = ethers.utils.parseEther("0");
    signature = await sign({
      manager: subject.manager,
      hashed,
      on,
      creator: creator.address,
      to: owner,
      price,
      discount,
      timeout,
    });
  });

  it("should work when mint on un-minted topic", async () => {
    const expectedTokenID = 2;
    const on =
      "0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
    const timeout = currentTimestampInSeconds() + 600;
    const signature = await sign({
      manager: subject.manager,
      hashed,
      on,
      creator: creator.address,
      to: owner,
      price,
      discount,
      timeout,
    });

    const tx = subject.instance
      .connect(owner)
      .mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
        discount,
        timeout,
        signature,
        {
          value: price,
        }
      );
    await assertEvents(subject.instance, tx, [
      ["Mint", [expectedTokenID, hashed, on]],
      ["TokenRoyaltyHolder", [expectedTokenID, creator.address]],
      ["TokenPrice", [expectedTokenID, price]],
      ["Buy", [expectedTokenID, price]],
      [
        "Transfer",
        [ethers.constants.AddressZero, owner.address, expectedTokenID],
      ],
      ["TokenPrice", [expectedTokenID, nextPrice]],
    ]);
  });

  it("should work with valid event log", async () => {
    const expectedTokenID = 2;
    const tx = subject.instance
      .connect(owner)
      .mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
        discount,
        timeout,
        signature,
        {
          value: price,
        }
      );
    await assertEvents(subject.instance, tx, [
      ["Mint", [expectedTokenID, hashed, on]],
      ["TokenRoyaltyHolder", [expectedTokenID, creator.address]],
      ["TokenPrice", [expectedTokenID, price]],
      ["Buy", [expectedTokenID, price]],
      [
        "Transfer",
        [ethers.constants.AddressZero, owner.address, expectedTokenID],
      ],
      ["TokenPrice", [expectedTokenID, nextPrice]],
    ]);
  });

  it("should work when contract owner or contract address is the creator", async () => {
    for (const [idx, creator] of [
      subject.contractOwner,
      subject.instance,
    ].entries()) {
      const expectedTokenID = idx + 2;
      const balance = {
        contract: await ethers.provider.getBalance(subject.instance.address),
        onOwner: await ethers.provider.getBalance(onOwner.address),
      };
      const hashed = ethers.utils.sha256(
        ethers.utils.toUtf8Bytes(`bar${idx}`, "NFC" as any)
      );
      const tx = subject.instance.connect(owner).mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed,
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

      await assertEvents(subject.instance, tx, [
        ["Mint", [expectedTokenID, hashed, on]],
        ["TokenRoyaltyHolder", [expectedTokenID, creator.address]],
        ["TokenPrice", [expectedTokenID, price]],
        ["Buy", [expectedTokenID, price]],
        [
          "Transfer",
          [ethers.constants.AddressZero, owner.address, expectedTokenID],
        ],
        ["TokenPrice", [expectedTokenID, nextPrice]],
      ]);

      expect(price).equals(ethers.utils.parseEther("0.01"));
      expect(await ethers.provider.getBalance(subject.instance.address)).equals(
        balance.contract.add(ethers.utils.parseEther("0.008"))
      );
      expect(await ethers.provider.getBalance(onOwner.address)).equals(
        balance.onOwner.add(ethers.utils.parseEther("0.002"))
      );
    }
  });

  it("should send on ethers to contract when on is empty", async () => {
    const expectedTokenID = 2;
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      creator: await ethers.provider.getBalance(creator.address),
    };
    const on = ethers.constants.HashZero;
    const tx = subject.instance.connect(owner).mint(
      hashed,
      on,
      creator.address,
      price,
      nextPrice,
      discount,
      timeout,
      await sign({
        manager: subject.manager,
        hashed,
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

    await assertEvents(subject.instance, tx, [
      ["Mint", [expectedTokenID, hashed, on]],
      ["TokenRoyaltyHolder", [expectedTokenID, creator.address]],
      ["TokenPrice", [expectedTokenID, price]],
      ["Buy", [expectedTokenID, price]],
      [
        "Transfer",
        [ethers.constants.AddressZero, owner.address, expectedTokenID],
      ],
      ["TokenPrice", [expectedTokenID, nextPrice]],
    ]);

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
    await subject.instance.connect(owner).mint(
      hashed,
      on,
      owner.address,
      price,
      nextPrice,
      discount,
      timeout,
      await sign({
        manager: subject.manager,
        hashed,
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
      hashed,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
      .mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
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
      hashed,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
      .mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
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
      hashed,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
      .mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
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
      subject.instance.connect(owner).mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed,
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
      subject.instance.connect(owner).mint(
        ethers.constants.HashZero,
        on,
        creator.address,
        price,
        nextPrice,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed: ethers.constants.HashZero,
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
      .mint(
        hashed,
        on,
        creator.address,
        price,
        nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          on,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          hashed,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          onOwner.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price.sub(1),
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
        .mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
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
      subject.instance.connect(owner).mint(
        hashed,
        on,
        ethers.constants.AddressZero,
        price,
        nextPrice,
        discount,
        timeout,
        await sign({
          manager: subject.manager,
          hashed,
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
        .estimateGas.mint(
          hashed,
          on,
          creator.address,
          price,
          nextPrice,
          discount,
          timeout,
          signature,
          {
            value: price,
          }
        )
    ).closeTo(210000, 15_000);
  });
});
