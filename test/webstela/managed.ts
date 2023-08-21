import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy} from "./common/helper";

describe("managed", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let to: string;

  beforeEach(async () => {
    subject = await deploy();
    to = subject.users[1].address;
  });

  describe("contractOwner", () => {
    it("get", async () => {
      expect(await subject.instance.contractOwner()).equals(
        subject.contractOwner.address
      );
    });

    it("setContractOwner by the contract owner should work", async () => {
      await expect(
        subject.instance.connect(subject.contractOwner).setContractOwner(to)
      )
        .emit(subject.instance, "ContractOwner")
        .withArgs(subject.contractOwner.address, to);
      expect(await subject.instance.contractOwner()).to.equals(to);
    });

    it("setContractOwner should execute withdraw", async () => {
      await subject.users[0].sendTransaction({
        to: subject.instance.address,
        value: ethers.utils.parseEther("0.1"),
      });
      const balances = {
        contract: await ethers.provider.getBalance(subject.instance.address),
        contractOwner: await subject.contractOwner.getBalance(),
      };
      expect(balances.contract).greaterThan(0);

      const gas = await subject.instance
        .connect(subject.contractOwner)
        .estimateGas.setContractOwner(to);
      const tx = await subject.instance
        .connect(subject.contractOwner)
        .setContractOwner(to);

      expect(await ethers.provider.getBalance(subject.instance.address)).equals(
        0
      );
      expect(await subject.contractOwner.getBalance()).equals(
        balances.contractOwner
          .add(balances.contract)
          .sub(gas.mul(tx.gasPrice ?? 0))
      );
    });

    it("setContractOwner by the manager should be reverted", async () => {
      await expect(
        subject.instance.connect(subject.users[0]).setContractOwner(to)
      ).revertedWith("caller is not the contract owner");
    });

    it("setContractOwner by a stranger should be reverted", async () => {
      await expect(
        subject.instance.connect(subject.users[0]).setContractOwner(to)
      ).revertedWith("caller is not the contract owner");
    });

    it("setContractOwner to zero balanced address should be reverted", async () => {
      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .setContractOwner(ethers.Wallet.createRandom().address)
      ).revertedWith("invalid address");
    });
  });

  describe("withdraw", async () => {
    it("should works", async () => {
      const user = subject.users[0];
      await user.sendTransaction({
        to: subject.instance.address,
        value: ethers.utils.parseEther("0.1"),
      });
      const balances = {
        contract: await ethers.provider.getBalance(subject.instance.address),
        contractOwner: await subject.contractOwner.getBalance(),
      };
      expect(balances.contract).greaterThan(0);
      await subject.instance.connect(user).withdraw();
      expect(await ethers.provider.getBalance(subject.instance.address)).equals(
        0
      );
      expect(await subject.contractOwner.getBalance()).equals(
        balances.contractOwner.add(balances.contract)
      );
    });
  });

  describe("manager", () => {
    it("get", async () => {
      expect(await subject.instance.manager()).equals(subject.manager.address);
    });

    it("setManager by the contract owner should work", async () => {
      await expect(
        subject.instance.connect(subject.contractOwner).setManager(to)
      )
        .emit(subject.instance, "Manager")
        .withArgs(subject.manager.address, to);
      expect(await subject.instance.manager()).to.equals(to);
    });

    it("setManager by the manager should work", async () => {
      await expect(subject.instance.connect(subject.manager).setManager(to))
        .emit(subject.instance, "Manager")
        .withArgs(subject.manager.address, to);
      expect(await subject.instance.manager()).to.equals(to);
    });

    it("setManager by a stranger should be reverted", async () => {
      await expect(
        subject.instance.connect(subject.users[0]).setManager(to)
      ).revertedWith("caller is not the contract owner or the manager");
    });
  });

  describe("setSymbol", () => {
    const valid = "foobar";

    it("should work with events", async () => {
      expect(await subject.instance.symbol()).equals("WSTLA");

      await expect(subject.instance.setSymbol(valid))
        .emit(subject.instance, "Symbol")
        .withArgs(valid);

      expect(await subject.instance.symbol()).equals(valid);
    });

    it("should revert without the manager", async () => {
      await expect(
        subject.instance.connect(subject.contractOwner).setSymbol(valid)
      ).revertedWith("caller is not the manager");
    });
  });

  describe("setMintFee", () => {
    const valid = {on: 7_00, royalty: 9_00};

    it("should work with events", async () => {
      await expect(subject.instance.setMintFee(valid.on, valid.royalty))
        .emit(subject.instance, "MintFee")
        .withArgs(valid.on, valid.royalty);
    });

    it("should revert without the manager", async () => {
      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .setMintFee(valid.on, valid.royalty)
      ).revertedWith("caller is not the manager");
    });

    it("should revert without commission", async () => {
      await expect(
        subject.instance.setMintFee(100_00 - valid.royalty, valid.royalty)
      ).revertedWith("too low commission");
    });
  });

  describe("setBuyFee", () => {
    const valid = {fee: 10, royalty: 9};

    it("should work with events", async () => {
      await expect(subject.instance.setBuyFee(valid.fee, valid.royalty))
        .emit(subject.instance, "BuyFee")
        .withArgs(valid.fee, valid.royalty);
    });

    it("should revert without the manager", async () => {
      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .setBuyFee(valid.fee, valid.royalty)
      ).revertedWith("caller is not the manager");
    });

    it("should revert with too high fee", async () => {
      await expect(
        subject.instance.setBuyFee(10000, valid.royalty)
      ).revertedWith("too high fee");
    });

    it("should revert without commission", async () => {
      await expect(
        subject.instance.setBuyFee(valid.royalty, valid.royalty)
      ).revertedWith("too low commission");
    });
  });

  describe("callFor", () => {
    it("should revert without contractOwner", async () => {
      const target = await (
        await ethers.getContractFactory("DebugCallable")
      ).deploy();

      await expect(
        subject.instance
          .connect(subject.manager)
          .callFor(target.address, 0, ethers.utils.parseEther("0.0001"), [])
      ).revertedWith("caller is not the contract owner");
    });

    it("should call receive", async () => {
      const target = await (
        await ethers.getContractFactory("DebugCallable")
      ).deploy();

      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .callFor(target.address, 0, ethers.utils.parseEther("0.0001"), [])
      )
        .emit(target, "Called")
        .withArgs("receive", subject.instance.address, 0, "0x");

      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .callFor(
            target.address,
            ethers.utils.parseEther("1.5"),
            ethers.utils.parseEther("0.0001"),
            [],
            {
              value: ethers.utils.parseEther("3"),
            }
          )
      )
        .emit(target, "Called")
        .withArgs(
          "receive",
          subject.instance.address,
          ethers.utils.parseEther("1.5"),
          "0x"
        );
    });

    it("should call fallback", async () => {
      const target = await (
        await ethers.getContractFactory("DebugCallable")
      ).deploy();

      const data = "0x59";

      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .callFor(target.address, 0, ethers.utils.parseEther("0.0001"), data)
      )
        .emit(target, "Called")
        .withArgs("fallback", subject.instance.address, 0, data);

      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .callFor(
            target.address,
            ethers.utils.parseEther("1.5"),
            ethers.utils.parseEther("0.0001"),
            data,
            {
              value: ethers.utils.parseEther("3"),
            }
          )
      )
        .emit(target, "Called")
        .withArgs(
          "fallback",
          subject.instance.address,
          ethers.utils.parseEther("1.5"),
          data
        );
    });

    it("should call func", async () => {
      const target = await (
        await ethers.getContractFactory("DebugCallable")
      ).deploy();

      expect(await target.addr()).equals(ethers.constants.AddressZero);

      const data = ethers.utils.concat([
        ethers.utils.id("pay(address)").substring(0, 10),
        ethers.utils.defaultAbiCoder.encode(
          ["address"],
          [subject.users[9].address]
        ),
      ]);

      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .callFor(target.address, 0, ethers.utils.parseEther("0.0001"), data)
      )
        .emit(target, "Called")
        .withArgs("pay", subject.instance.address, 0, data);

      expect(await target.addr()).equals(subject.users[9].address);

      await expect(
        subject.instance
          .connect(subject.contractOwner)
          .callFor(
            target.address,
            ethers.utils.parseEther("1.5"),
            ethers.utils.parseEther("0.0001"),
            data,
            {
              value: ethers.utils.parseEther("3"),
            }
          )
      )
        .emit(target, "Called")
        .withArgs(
          "pay",
          subject.instance.address,
          ethers.utils.parseEther("1.5"),
          data
        );
    });
  });
});
