import {expect} from "chai";
import {ethers} from "hardhat";

import {
  assertEvents,
  deploy,
  mint,
  BigNumber,
  SignerWithAddress,
  Token,
} from "./common/helper";

describe("buyFor", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let store: SignerWithAddress;
  let buyer: SignerWithAddress;
  let token: Token;
  let tokenId: number;

  beforeEach(async () => {
    subject = await deploy();
    token = {
      hashed: ethers.utils.sha256(
        ethers.utils.toUtf8Bytes("bar", "NFC" as any)
      ),
      creator: subject.users[0],
      owner: subject.users[1],
      nextPrice: ethers.utils.parseEther("0.02"),
    };
    store = subject.users[3];
    buyer = subject.users[2];
    tokenId = 1;

    await mint(subject, token);
  });

  it("should work with events and distribution", async () => {
    const nextPrice = ethers.utils.parseEther("0.1");
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      tokenOwner: await token.owner.getBalance(),
      royaltyHolder: await token.creator.getBalance(),
      buyer: await buyer.getBalance(),
      store: await store.getBalance(),
    };

    const tx = subject.instance
      .connect(store)
      .buyFor(tokenId, nextPrice, buyer.address, {
        value: ethers.utils.parseEther("0.03"),
      });
    const receipt = await (await tx).wait();
    const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    await assertEvents(subject.instance, tx, [
      ["Buy", [tokenId, token.nextPrice]],
      ["Transfer", [token.owner.address, buyer.address, tokenId]],
      ["TokenPrice", [tokenId, nextPrice]],
    ]);

    expect(await buyer.getBalance()).equals(balance.buyer);
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.contract.add(ethers.utils.parseEther("0.001"))
    );
    expect(await token.creator.getBalance()).equals(
      balance.royaltyHolder.add(ethers.utils.parseEther("0.001"))
    );
    expect(await token.owner.getBalance()).equals(
      balance.tokenOwner.add(ethers.utils.parseEther("0.018"))
    );
    expect(await store.getBalance()).equals(
      balance.store.sub(token.nextPrice).sub(gas)
    );
  });

  it("should work with events and distribution when store is token owner", async () => {
    const nextPrice = ethers.utils.parseEther("0.1");
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      tokenOwner: await token.owner.getBalance(),
      royaltyHolder: await token.creator.getBalance(),
      buyer: await buyer.getBalance(),
    };

    const tx = subject.instance
      .connect(token.owner)
      .buyFor(tokenId, nextPrice, buyer.address, {
        value: ethers.utils.parseEther("0.03"),
      });
    const receipt = await (await tx).wait();
    expect(receipt.gasUsed).closeTo(100_000, 10_000);
    const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    await assertEvents(subject.instance, tx, [
      ["Buy", [tokenId, token.nextPrice]],
      ["Transfer", [token.owner.address, buyer.address, tokenId]],
      ["TokenPrice", [tokenId, nextPrice]],
    ]);

    expect(await buyer.getBalance()).equals(balance.buyer);
    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.contract.add(ethers.utils.parseEther("0.001"))
    );
    expect(await token.creator.getBalance()).equals(
      balance.royaltyHolder.add(ethers.utils.parseEther("0.001"))
    );

    expect(await token.owner.getBalance()).equals(
      balance.tokenOwner
        .add(ethers.utils.parseEther("0.018"))
        .sub(token.nextPrice)
        .sub(gas)
    );
  });

  it("should work with events and distribution when buyer is royalty holder", async () => {
    const nextPrice = ethers.utils.parseEther("0.1");
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      tokenOwner: await token.owner.getBalance(),
      royaltyHolder: await token.creator.getBalance(),
    };

    const tx = subject.instance
      .connect(token.owner)
      .buyFor(tokenId, nextPrice, token.creator.address, {
        value: ethers.utils.parseEther("0.03"),
      });
    const receipt = await (await tx).wait();
    const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    expect(receipt.gasUsed).closeTo(100_000, 10_000);

    await assertEvents(subject.instance, tx, [
      ["Buy", [tokenId, token.nextPrice]],
      ["Transfer", [token.owner.address, token.creator.address, tokenId]],
      ["TokenPrice", [tokenId, nextPrice]],
    ]);

    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.contract.add(ethers.utils.parseEther("0.001"))
    );
    expect(await token.creator.getBalance()).equals(
      balance.royaltyHolder.add(ethers.utils.parseEther("0.001"))
    );

    expect(await token.owner.getBalance()).equals(
      balance.tokenOwner
        .add(ethers.utils.parseEther("0.018"))
        .sub(token.nextPrice)
        .sub(gas)
    );
  });

  it("should revert without token price", async () => {
    await subject.instance.connect(token.owner).setTokenPrice(tokenId, 0);
    await expect(
      subject.instance
        .connect(store)
        .buyFor(tokenId, ethers.utils.parseEther("0.1"), buyer.address, {
          value: ethers.utils.parseEther("0.1"),
        })
    ).revertedWith("locked to sell");
  });

  it("should revert without enough ethers", async () => {
    await expect(
      subject.instance
        .connect(buyer)
        .buyFor(tokenId, ethers.utils.parseEther("0.1"), buyer.address, {
          value: ethers.utils.parseEther("0.02").sub(1),
        })
    ).revertedWith("not enough ethers");
  });

  it("estimate gas", async () => {
    const nextPrice = ethers.utils.parseEther("0.1");
    expect(
      await subject.instance
        .connect(buyer)
        .estimateGas.buyFor(tokenId, nextPrice, buyer.address, {
          value: token.nextPrice,
        })
    ).closeTo(105_000, 10_000);
  });
});

describe("buy", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let buyer: SignerWithAddress;
  let token: Token;
  let tokenId: number;

  beforeEach(async () => {
    subject = await deploy();
    token = {
      hashed: ethers.utils.sha256(
        ethers.utils.toUtf8Bytes("bar", "NFC" as any)
      ),
      creator: subject.users[0],
      owner: subject.users[1],
      nextPrice: ethers.utils.parseEther("0.02"),
    };
    buyer = subject.users[2];
    tokenId = 1;

    await mint(subject, token);
  });

  it("should work with events and distribution", async () => {
    const nextPrice = ethers.utils.parseEther("0.1");
    const balance = {
      contract: await ethers.provider.getBalance(subject.instance.address),
      tokenOwner: await token.owner.getBalance(),
      royaltyHolder: await token.creator.getBalance(),
    };

    const tx = subject.instance.connect(buyer).buy(tokenId, nextPrice, {
      value: ethers.utils.parseEther("0.03"),
    });

    await assertEvents(subject.instance, tx, [
      ["Buy", [tokenId, token.nextPrice]],
      ["Transfer", [token.owner.address, buyer.address, tokenId]],
      ["TokenPrice", [tokenId, nextPrice]],
    ]);

    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.contract.add(ethers.utils.parseEther("0.001"))
    );
    expect(await token.creator.getBalance()).equals(
      balance.royaltyHolder.add(ethers.utils.parseEther("0.001"))
    );
    expect(await token.owner.getBalance()).equals(
      balance.tokenOwner.add(ethers.utils.parseEther("0.018"))
    );
  });

  it("should revert without token price", async () => {
    await subject.instance.connect(token.owner).setTokenPrice(tokenId, 0);
    await expect(
      subject.instance
        .connect(buyer)
        .buy(tokenId, ethers.utils.parseEther("0.1"), {
          value: ethers.utils.parseEther("0.1"),
        })
    ).revertedWith("locked to sell");
  });

  it("should revert without enough ethers", async () => {
    await expect(
      subject.instance
        .connect(buyer)
        .buy(tokenId, ethers.utils.parseEther("0.1"), {
          value: ethers.utils.parseEther("0.02").sub(1),
        })
    ).revertedWith("not enough ethers");
  });

  it("estimate gas", async () => {
    const nextPrice = ethers.utils.parseEther("0.1");
    expect(
      await subject.instance
        .connect(buyer)
        .estimateGas.buy(tokenId, nextPrice, {
          value: token.nextPrice,
        })
    ).closeTo(105_000, 10_000);
  });
});

describe("buyBatch", () => {
  const commission = 5;
  const royalty = 5;
  const net = 90;

  let subject: Awaited<ReturnType<typeof deploy>>;
  let buyer: SignerWithAddress;
  let tokens: Token[];
  let tokenIds: number[];
  let nextPrices: BigNumber[];
  let total: BigNumber;

  beforeEach(async () => {
    subject = await deploy();
    buyer = subject.users[0];
    tokens = [
      {
        hashed: ethers.utils.sha256(
          ethers.utils.toUtf8Bytes("bar-0", "NFC" as any)
        ),
        creator: subject.users[1],
        owner: subject.users[2],
        nextPrice: ethers.utils.parseEther("0.021"),
      },
      {
        hashed: ethers.utils.sha256(
          ethers.utils.toUtf8Bytes("bar-1", "NFC" as any)
        ),
        creator: subject.users[3],
        owner: subject.users[4],
        nextPrice: ethers.utils.parseEther("0.022"),
      },
      {
        hashed: ethers.utils.sha256(
          ethers.utils.toUtf8Bytes("bar-2", "NFC" as any)
        ),
        creator: subject.users[5],
        owner: subject.users[6],
        nextPrice: ethers.utils.parseEther("0.023"),
      },
    ];
    tokenIds = [1, 2, 3];
    nextPrices = [
      ethers.utils.parseEther("0.11"),
      ethers.utils.parseEther("0.12"),
      ethers.utils.parseEther("0.13"),
    ];
    total = tokens.reduce(
      (acc, cur) => acc.add(cur.nextPrice ?? 0),
      ethers.utils.parseEther("0")
    );
  });

  describe("3 tokens involving 7 accounts", () => {
    beforeEach(async () => {
      await mint(subject, tokens[0]);
      await mint(subject, tokens[1]);
      await mint(subject, tokens[2]);
    });

    const test = async (value: BigNumber) => {
      const tx = subject.instance
        .connect(buyer)
        .buyBatch(tokenIds, nextPrices, {
          value,
        });

      await assertEvents(
        subject.instance,
        tx,
        tokens.reduce((acc, token, idx) => {
          return acc.concat([
            ["Buy", [tokenIds[idx], token.nextPrice]],
            ["Transfer", [token.owner.address, buyer.address, tokenIds[idx]]],
            ["TokenPrice", [tokenIds[idx], nextPrices[idx]]],
          ] as any);
        }, [])
      );

      await expect(tx).changeEtherBalances(
        [
          subject.instance.address,
          subject.users[1],
          subject.users[2],
          subject.users[3],
          subject.users[4],
          subject.users[5],
          subject.users[6],
          buyer,
        ],
        [
          total.mul(commission).div(100),
          tokens[0].nextPrice.mul(royalty).div(100),
          tokens[0].nextPrice.mul(net).div(100),
          tokens[1].nextPrice.mul(royalty).div(100),
          tokens[1].nextPrice.mul(net).div(100),
          tokens[2].nextPrice.mul(royalty).div(100),
          tokens[2].nextPrice.mul(net).div(100),
          total.mul(-1),
        ]
      );
    };

    it("should work with events and distribution", async () => {
      await test(total);
    });

    it("should refund extra ethers", async () => {
      await test(total.mul(2));
    });

    it("should revert without token price", async () => {
      await subject.instance
        .connect(tokens[0].owner)
        .setTokenPrice(tokenIds[0], 0);
      await expect(
        subject.instance.connect(buyer).buyBatch(tokenIds, nextPrices, {
          value: total,
        })
      ).revertedWith("locked to sell");
    });

    it("should revert without enough ethers", async () => {
      await expect(
        subject.instance.connect(buyer).buyBatch(tokenIds, nextPrices, {
          value: total.sub(1),
        })
      ).revertedWith("not enough ethers");
    });

    it("should revert with invalid length", async () => {
      await expect(
        subject.instance.connect(buyer).buyBatch(tokenIds, [nextPrices[0]], {
          value: total,
        })
      ).revertedWith("invalid arguments");
    });

    it("estimate gas", async () => {
      expect(
        await subject.instance
          .connect(buyer)
          .estimateGas.buyBatch(tokenIds, nextPrices, {
            value: total,
          })
      ).closeTo(105_000 + 50_000 * 2, 30_000);
    });
  });

  describe("3 tokens involving 5 accounts", () => {
    beforeEach(async () => {
      tokens[0].creator = subject.users[1];
      tokens[0].owner = subject.users[1];
      tokens[1].creator = subject.users[2];
      tokens[1].owner = subject.users[3];
      tokens[2].creator = subject.users[3];
      tokens[2].owner = subject.users[4];

      await mint(subject, tokens[0]);
      await mint(subject, tokens[1]);
      await mint(subject, tokens[2]);
    });

    const test = async (value: BigNumber) => {
      const tx = subject.instance
        .connect(buyer)
        .buyBatch(tokenIds, nextPrices, {
          value,
        });

      await assertEvents(
        subject.instance,
        tx,
        tokens.reduce((acc, token, idx) => {
          return acc.concat([
            ["Buy", [tokenIds[idx], token.nextPrice]],
            ["Transfer", [token.owner.address, buyer.address, tokenIds[idx]]],
            ["TokenPrice", [tokenIds[idx], nextPrices[idx]]],
          ] as any);
        }, [])
      );

      await expect(tx).changeEtherBalances(
        [
          subject.instance.address,
          subject.users[1],
          subject.users[2],
          subject.users[3],
          subject.users[4],
          buyer,
        ],
        [
          total.mul(commission).div(100),
          tokens[0].nextPrice
            .mul(royalty)
            .div(100)
            .add(tokens[0].nextPrice.mul(net).div(100)),
          tokens[1].nextPrice.mul(royalty).div(100),
          tokens[1].nextPrice
            .mul(net)
            .div(100)
            .add(tokens[2].nextPrice.mul(royalty).div(100)),
          tokens[2].nextPrice.mul(net).div(100),
          total.mul(-1),
        ]
      );
    };

    it("should work with events and distribution", async () => {
      await test(total);
    });

    it("should refund extra ethers", async () => {
      await test(total.mul(2));
    });
  });

  describe("3 tokens involving 3 accounts", () => {
    beforeEach(async () => {
      tokens[0].creator = buyer;
      tokens[0].owner = buyer;
      tokens[1].creator = subject.users[1];
      tokens[1].owner = buyer;
      tokens[2].creator = buyer;
      tokens[2].owner = subject.users[2];

      await mint(subject, tokens[0]);
      await mint(subject, tokens[1]);
      await mint(subject, tokens[2]);
    });

    const test = async (value: BigNumber) => {
      const tx = subject.instance
        .connect(buyer)
        .buyBatch(tokenIds, nextPrices, {
          value,
        });

      await assertEvents(
        subject.instance,
        tx,
        tokens.reduce((acc, token, idx) => {
          return acc.concat([
            ["Buy", [tokenIds[idx], token.nextPrice]],
            ["Transfer", [token.owner.address, buyer.address, tokenIds[idx]]],
            ["TokenPrice", [tokenIds[idx], nextPrices[idx]]],
          ] as any);
        }, [])
      );

      await expect(tx).changeEtherBalances(
        [subject.instance.address, subject.users[1], subject.users[2], buyer],
        [
          total.mul(commission).div(100),
          tokens[1].nextPrice.mul(royalty).div(100),
          tokens[2].nextPrice.mul(net).div(100),
          total
            .sub(tokens[0].nextPrice.mul(royalty).div(100))
            .sub(tokens[0].nextPrice.mul(net).div(100))
            .sub(tokens[1].nextPrice.mul(net).div(100))
            .sub(tokens[2].nextPrice.mul(royalty).div(100))
            .mul(-1),
        ]
      );
    };

    it("should work with events and distribution", async () => {
      await test(total);
    });

    it("should refund extra ethers", async () => {
      await test(total.mul(2));
    });
  });
});
