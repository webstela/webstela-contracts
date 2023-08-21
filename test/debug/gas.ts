import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy} from "./common";

describe("[debug] gas", () => {
  it("estimate gas", async () => {
    const subject = await deploy("DebugGas");

    expect(
      await subject.instance.estimateGas.run({
        value: ethers.utils.parseEther("0.01"),
      })
    ).closeTo(21_000, 1000);
  });
});
