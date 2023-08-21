import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy} from "./common";

describe("[debug] string type conversion", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  const expected = {
    string: "ABC강😆",
    paddedString:
      "ABC강😆\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
    bytes: "0x414243eab095f09f988600000000000000000000000000000000000000000000",
  };

  before(async () => {
    subject = await deploy("DebugString");
  });

  it("string to bytes", async () => {
    expect(await subject.instance.estimateGas.stringToBytesAssembly()).closeTo(
      25_000,
      2000
    );
    await expect(subject.instance.stringToBytesAssembly())
      .emit(subject.instance, "StringToBytes")
      .withArgs(expected.string, expected.bytes);

    expect(await subject.instance.estimateGas.stringToBytesABI()).closeTo(
      25_000,
      2000
    );
    await expect(subject.instance.stringToBytesABI())
      .emit(subject.instance, "StringToBytes")
      .withArgs(expected.string, expected.bytes);
  });

  it("bytes to string", async () => {
    expect(await subject.instance.estimateGas.bytesToStringAssembly()).closeTo(
      25_000,
      2000
    );
    await expect(subject.instance.bytesToStringAssembly())
      .emit(subject.instance, "BytesToString")
      .withArgs(expected.bytes, expected.paddedString);

    expect(await subject.instance.estimateGas.bytesToStringABI()).closeTo(
      25_000,
      2000
    );
    await expect(subject.instance.bytesToStringABI())
      .emit(subject.instance, "BytesToString")
      .withArgs(expected.bytes, expected.paddedString);

    const pure = await subject.instance.pureBytesToStringAssembly();
    expect(pure).equals(expected.paddedString);
    expect(await subject.instance.pureBytesToStringABI()).equals(pure);
  });

  it("in eth, string is right padded. So never use bytesToString on emits or views", async () => {
    expect(ethers.utils.toUtf8String(expected.bytes)).equals(
      expected.paddedString
    );
    expect("ABC강😆".length).equals(5 + 1);
    expect((await subject.instance.pureUnicodeLength()).toNumber()).equals(10);
  });
});
