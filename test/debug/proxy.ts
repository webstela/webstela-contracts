import {expect} from "chai";

import {deploy} from "./common";

describe("[debug] proxy", () => {
  it("delegatecall use caller state on both read and write", async () => {
    const logic = await deploy("DebugLogic");
    expect(await logic.instance.name()).equals("foo");
    expect(await logic.instance.myName()).equals("impl");

    const proxy = await deploy("DebugProxy", logic.instance.address);
    expect(await proxy.instance.name()).equals("bar");
    expect(await proxy.instance.myName()).equals("proxy");

    expect(await proxy.instance.estimateGas.setNameByImpl()).closeTo(
      35_000,
      3000
    );
    await proxy.instance.setNameByImpl();
    expect(await logic.instance.name()).equals("foo");
    expect(await proxy.instance.name()).equals("proxy");

    expect(await proxy.instance.estimateGas.setName("baz")).closeTo(
      30_000,
      4000
    );
    await proxy.instance.setName("baz");
    expect(await logic.instance.name()).equals("foo");
    expect(await proxy.instance.name()).equals("baz");

    expect(await logic.instance.estimateGas.setName("qux")).closeTo(
      30_000,
      3000
    );
    await logic.instance.setName("qux");
    expect(await logic.instance.name()).equals("qux");
    expect(await proxy.instance.name()).equals("baz");

    await expect(proxy.instance.setName("")).revertedWithoutReason();
  });
});
