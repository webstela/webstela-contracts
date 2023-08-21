import {expect} from "chai";

import {deploy} from "./common";

describe("[debug] math", () => {
  it("math should be safe under unchecked block", async () => {
    const subject = await deploy("DebugMath");

    await expect(subject.instance.divideByZero()).revertedWithPanic("0x12");
    await expect(subject.instance.overflowByAdd()).revertedWithPanic("0x11");
    await expect(subject.instance.overflowByMul()).revertedWithPanic("0x11");
    await expect(subject.instance.underflow()).revertedWithPanic("0x11");
  });
});
