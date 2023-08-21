import {ethers} from "hardhat";
import {
  deploy,
  currentTimestampInSeconds,
  sign,
} from "../test/webstela/common/helper";

async function main() {
  const subject = await deploy();

  const onOwner = subject.users[0];
  const creator = subject.users[1];
  const owner = subject.users[2];

  const on = ethers.utils.sha256(ethers.utils.toUtf8Bytes("foo", "NFC" as any));
  const hashed = ethers.utils.sha256(
    ethers.utils.toUtf8Bytes("bar", "NFC" as any)
  );

  const timeout = currentTimestampInSeconds() + 600;

  await subject.instance.mintByManager(
    on,
    ethers.constants.HashZero,
    onOwner.address,
    onOwner.address,
    0,
    0
  );

  const price = ethers.utils.parseEther("0.01");
  const nextPrice = ethers.utils.parseEther("0.02");
  const discount = ethers.utils.parseEther("0");
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
