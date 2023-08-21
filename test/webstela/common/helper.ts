import {expect} from "chai";
import {ethers} from "hardhat";

export const deploy = async () => {
  const [contractOwner, manager, ...users] = await ethers.getSigners();

  const contract = await ethers.getContractFactory("Webstela");
  const instance = await contract.deploy(manager.address);

  return {instance: instance.connect(manager), contractOwner, manager, users};
};

export const deployERC721Receiver = async () => {
  const accounts = await ethers.getSigners();
  const [owner, other] = accounts;

  const contract = await ethers.getContractFactory("DebugERC721Receiver");
  const instance = await contract.deploy();

  return {instance, owner, other, accounts};
};

export const sign = async ({
  manager,
  hashed,
  on,
  creator,
  to,
  price,
  discount,
  timeout,
}: {
  manager: SignerWithAddress;
  hashed: string | Uint8Array;
  on: string;
  creator: string;
  to: SignerWithAddress;
  price: BigNumber;
  discount: BigNumber;
  timeout: number;
}) => {
  const items = [
    typeof hashed === "string" ? ethers.utils.arrayify(hashed) : hashed,
    ethers.utils.arrayify(on),
    ethers.utils.arrayify(creator),
    ethers.utils.arrayify(to.address),
    ethers.utils.arrayify(
      "0x" + price.toHexString().substring(2).padStart(64, "0")
    ),
    ethers.utils.arrayify(
      "0x" + discount.toHexString().substring(2).padStart(64, "0")
    ),
    ethers.utils.arrayify(
      "0x" + ethers.utils.hexlify(timeout).substring(2).padStart(64, "0")
    ),
  ];
  const encoded = ethers.utils.concat(items);
  const data = ethers.utils.arrayify(ethers.utils.sha256(encoded));
  const signature = await manager.signMessage(data);
  return signature;
};

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type SignerWithAddress = ArrayElement<
  Awaited<ReturnType<typeof ethers.getSigners>>
>;

export type BigNumber = ReturnType<typeof ethers.utils.parseEther>;

export type Token = {
  hashed: string;
  owner: SignerWithAddress;
  creator: SignerWithAddress;
  nextPrice: BigNumber;
};

export const currentTimestampInSeconds = () => Math.round(Date.now() / 1000);

export const mint = async (
  subject: Awaited<ReturnType<typeof deploy>>,
  {hashed, owner, creator, nextPrice}: Token
) => {
  await subject.instance.mintByManager(
    hashed,
    ethers.constants.HashZero,
    creator.address,
    owner.address,
    0,
    nextPrice
  );
};

export const assertEvents = async (
  instance: any,
  tx: Promise<any>,
  events: [name: string, args: any[]][]
) => {
  const executedTX = await tx;
  const receipt = await executedTX.wait();
  expect(receipt.events.map((event: any) => event.event)).deep.equals(
    events.map(event => event[0])
  );

  let expected = expect(executedTX);
  for (const event of events) {
    expected = expected.emit(instance, event[0]).withArgs(...event[1]);
  }
  await (expected as any);
};
