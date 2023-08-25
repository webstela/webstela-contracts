import {ethers} from "hardhat";

import {assertEvents, deploy, sign} from "../common/helper";

describe("mint init", () => {
  it("should work when mint on un-minted topic", async () => {
    const subject = await deploy();
    const owner = subject.contractOwner;

    const expectedTokenID = 1;
    const hashed =
      "0x76036e47da5e398abe10056583c95e2f98cf8e1fe5aac8570586a90cb6b8c845";
    const on =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const price = ethers.utils.parseEther("0");
    const nextPrice = ethers.utils.parseEther("0");
    const discount = ethers.utils.parseEther("0");
    const timeout = 2000000000;
    const signature = await sign({
      manager: subject.manager,
      hashed,
      on,
      creator: owner.address,
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
        owner.address,
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
      ["TokenRoyaltyHolder", [expectedTokenID, owner.address]],
      ["TokenPrice", [expectedTokenID, price]],
      ["Buy", [expectedTokenID, price]],
      [
        "Transfer",
        [ethers.constants.AddressZero, owner.address, expectedTokenID],
      ],
    ]);
  });
});
