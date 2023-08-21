import {expect} from "chai";

import {deploy} from "../common/helper";

describe("ERC165", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;

  beforeEach(async () => {
    subject = await deploy();
  });

  it("supportsInterface", async () => {
    expect(await subject.instance.supportsInterface("0x00000000")).to.be.false;
    expect(await subject.instance.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
    expect(await subject.instance.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
    expect(await subject.instance.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata
  });
});
