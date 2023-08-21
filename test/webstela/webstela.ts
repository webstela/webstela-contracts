import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy} from "./common/helper";

describe("contract", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;

  beforeEach(async () => {
    subject = await deploy();
  });

  it("name", async () => {
    expect(await subject.instance.name()).equals("Webstela");
  });

  it("symbol", async () => {
    expect(await subject.instance.symbol()).equals("WSTLA");
  });

  it("receive", async () => {
    const balance = await ethers.provider.getBalance(subject.instance.address);

    await subject.users[0].sendTransaction({
      to: subject.instance.address,
      value: ethers.utils.parseEther("0.1"),
    });

    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.add(ethers.utils.parseEther("0.1"))
    );
  });

  it("fallback", async () => {
    const balance = await ethers.provider.getBalance(subject.instance.address);

    await subject.users[0].sendTransaction({
      to: subject.instance.address,
      value: ethers.utils.parseEther("0.1"),
      data: ethers.constants.HashZero,
    });

    expect(await ethers.provider.getBalance(subject.instance.address)).equals(
      balance.add(ethers.utils.parseEther("0.1"))
    );
  });
});
