import {expect} from "chai";

import {deploy} from "./common";

describe("[debug] signature", () => {
  it("should return proper signer", async () => {
    const subject = await deploy("DebugSignature");

    expect(
      await subject.instance.signerOf(
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "0xfcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
        "0x2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "10000000000000000",
        0,
        1691977669,
        "0xec787690cee3f3b56aa615364b0db4662131db35de43f648066f201919353b5474ae38cd2d3a1f35678a50ba06dd4973d3f5e81e6c65642fe94ecda8e17a80531b"
      )
    ).equal("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });
});
