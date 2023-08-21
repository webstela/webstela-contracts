import {expect} from "chai";
import {ethers} from "hardhat";

import {
  assertEvents,
  deploy,
  deployERC721Receiver,
  SignerWithAddress,
  BigNumber,
} from "../common/helper";

describe("ERC721", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  const hashed = ethers.utils
    .hexlify(
      ethers.utils.sha256(ethers.utils.toUtf8Bytes("valid", "NFC" as any))
    )
    .padEnd(66, "0");

  beforeEach(async () => {
    subject = await deploy();
  });

  it("token info", async () => {
    expect(await subject.instance.name()).equals("Webstela");
    expect(await subject.instance.symbol()).equals("WSTLA");
    expect(await subject.instance.totalSupply()).equals(0);
    expect(await subject.instance.balanceOf(subject.manager.address)).equals(0);
    expect(await subject.instance.balanceOf(subject.users[0].address)).equals(
      0
    );
    expect(await subject.instance["ownerOf(uint256)"](1)).equals(
      ethers.constants.AddressZero
    );
  });

  it("tokenURI", async () => {
    expect(await subject.instance.tokenURI(1)).equals(
      "https://static.webstela.com/nft/1"
    );
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      subject.manager.address,
      subject.contractOwner.address,
      0,
      0
    );
    expect(await subject.instance.tokenURI(1)).to.be.equals(
      "https://static.webstela.com/nft/1"
    );

    await expect(
      subject.instance.connect(subject.users[0]).setTokenURIBase("ipfs://hash/")
    ).to.be.revertedWith("caller is not the manager");
    await expect(subject.instance.setTokenURIBase("ipfs://hash/"))
      .to.emit(subject.instance, "TokenURIBase")
      .withArgs("ipfs://hash/");
    expect(await subject.instance.tokenURI(1)).to.be.equals("ipfs://hash/1");
  });

  it("balanceOf", async () => {
    const owner = subject.users[0];
    await expect(
      subject.instance.balanceOf(ethers.constants.AddressZero)
    ).to.be.revertedWith("address zero is not a valid owner");
    expect(await subject.instance.balanceOf(owner.address)).to.be.equals(0);
    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      subject.manager.address,
      owner.address,
      0,
      0
    );
    expect(await subject.instance.balanceOf(owner.address)).to.be.equals(1);
  });

  describe("setApprovalForAll", () => {
    let owner: SignerWithAddress;
    let operator: SignerWithAddress;

    beforeEach(async () => {
      owner = subject.users[0];
      operator = subject.users[1];
      await subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        subject.manager.address,
        owner.address,
        0,
        0
      );
    });

    it("should work with owner", async () => {
      expect(
        await subject.instance.isApprovedForAll(owner.address, operator.address)
      ).to.be.false;
      await expect(
        subject.instance
          .connect(owner)
          .setApprovalForAll(operator.address, true)
      )
        .to.emit(subject.instance, "ApprovalForAll")
        .withArgs(owner.address, operator.address, true);
      expect(
        await subject.instance.isApprovedForAll(owner.address, operator.address)
      ).to.be.true;
      await expect(
        subject.instance
          .connect(owner)
          .setApprovalForAll(operator.address, false)
      )
        .to.emit(subject.instance, "ApprovalForAll")
        .withArgs(owner.address, operator.address, false);
      expect(
        await subject.instance.isApprovedForAll(owner.address, operator.address)
      ).to.be.false;
    });

    it("should revert with caller", async () => {
      await expect(
        subject.instance.setApprovalForAll(subject.manager.address, true)
      ).to.be.revertedWith("approve to caller");
    });
  });

  describe("approve", () => {
    let owner: SignerWithAddress;
    let operator: SignerWithAddress;
    let other: SignerWithAddress;
    let tokenId: number;

    beforeEach(async () => {
      owner = subject.users[0];
      operator = subject.users[1];
      other = subject.users[2];
      tokenId = 1;
      await subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        subject.manager.address,
        owner.address,
        0,
        0
      );
    });

    it("should work with owner", async () => {
      expect(await subject.instance.getApproved(tokenId)).to.be.equals(
        ethers.constants.AddressZero
      );
      await expect(
        subject.instance.connect(owner).approve(operator.address, tokenId)
      )
        .to.emit(subject.instance, "Approval")
        .withArgs(owner.address, operator.address, tokenId);
      expect(await subject.instance.getApproved(tokenId)).to.be.equals(
        operator.address
      );
    });

    it("should work with isApprovedForAll", async () => {
      await subject.instance
        .connect(owner)
        .setApprovalForAll(operator.address, true);
      expect(await subject.instance.getApproved(tokenId)).to.be.equals(
        ethers.constants.AddressZero
      );
      await subject.instance.connect(operator).approve(other.address, tokenId);
      expect(await subject.instance.getApproved(tokenId)).to.be.equals(
        other.address
      );
    });

    it("should revert on self-approval", async () => {
      await expect(
        subject.instance.connect(owner).approve(owner.address, tokenId)
      ).to.be.revertedWith("approval to current owner");
    });

    it("should revert without owner or approvedAll", async () => {
      await expect(
        subject.instance.approve(subject.manager.address, tokenId)
      ).to.be.revertedWith(
        "approve caller is not the token owner or the approved for all"
      );
    });
  });

  describe("transfer", () => {
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let charlie: SignerWithAddress;
    let initialPrice: BigNumber;
    let tokenId: number;

    beforeEach(async () => {
      alice = subject.users[0];
      bob = subject.users[1];
      charlie = subject.users[2];
      initialPrice = ethers.utils.parseEther("0.01");
      await subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        subject.manager.address,
        alice.address,
        0,
        initialPrice
      );
      tokenId = 1;
      expect(await subject.instance.priceOf(tokenId)).equals(initialPrice);
    });

    const testTransferredTo = async (to: string) => {
      expect(await subject.instance.balanceOf(alice.address)).to.be.equals(0);
      expect(await subject.instance.balanceOf(to)).to.be.equals(1);
      expect(await subject.instance["ownerOf(uint256)"](tokenId)).to.be.equals(
        to
      );
      expect(await subject.instance.getApproved(tokenId)).to.be.equals(
        ethers.constants.AddressZero
      );
      expect(await subject.instance.priceOf(tokenId)).equals(0);
    };

    describe("transferFrom", () => {
      it("should work with token owner", async () => {
        let tx = subject.instance
          .connect(alice)
          .transferFrom(alice.address, bob.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [alice.address, bob.address, tokenId]],
          ["TokenPrice", [tokenId, 0]],
        ]);
        await testTransferredTo(bob.address);

        tx = subject.instance
          .connect(bob)
          .transferFrom(bob.address, alice.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [bob.address, alice.address, tokenId]],
        ]);
      });

      it("should work with approved", async () => {
        await subject.instance.connect(alice).approve(charlie.address, tokenId);
        let tx = subject.instance
          .connect(charlie)
          .transferFrom(alice.address, bob.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [alice.address, bob.address, tokenId]],
          ["TokenPrice", [tokenId, 0]],
        ]);
        await testTransferredTo(bob.address);
        tx = subject.instance
          .connect(bob)
          .transferFrom(bob.address, alice.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [bob.address, alice.address, tokenId]],
        ]);
      });

      it("should work with approved all", async () => {
        await subject.instance
          .connect(alice)
          .setApprovalForAll(charlie.address, true);
        let tx = subject.instance
          .connect(charlie)
          .transferFrom(alice.address, bob.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [alice.address, bob.address, tokenId]],
          ["TokenPrice", [tokenId, 0]],
        ]);
        await testTransferredTo(bob.address);
        tx = subject.instance
          .connect(bob)
          .transferFrom(bob.address, alice.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [bob.address, alice.address, tokenId]],
        ]);
      });

      it("should revert with contract owner", async () => {
        await expect(
          subject.instance.transferFrom(alice.address, bob.address, tokenId)
        ).to.be.revertedWith("caller is not the token owner or the approved");
      });

      it("should revert with invalid from address", async () => {
        await expect(
          subject.instance
            .connect(alice)
            .transferFrom(subject.manager.address, bob.address, tokenId)
        ).to.be.revertedWith("transfer from incorrect owner");
      });

      it("should revert with zero address", async () => {
        await expect(
          subject.instance
            .connect(alice)
            .transferFrom(alice.address, ethers.constants.AddressZero, tokenId)
        ).to.be.revertedWith("transfer to the zero address");
      });
    });

    describe("safeTransferFrom", () => {
      const signature = "safeTransferFrom(address,address,uint256)";
      const signatureWithData =
        "safeTransferFrom(address,address,uint256,bytes)";

      it("should work with token owner", async () => {
        let tx = subject.instance
          .connect(alice)
          [signature](alice.address, bob.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [alice.address, bob.address, tokenId]],
          ["TokenPrice", [tokenId, 0]],
        ]);
        await testTransferredTo(bob.address);
        tx = subject.instance
          .connect(bob)
          .transferFrom(bob.address, alice.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [bob.address, alice.address, tokenId]],
        ]);
      });

      it("should work with approved", async () => {
        await subject.instance.connect(alice).approve(charlie.address, tokenId);
        let tx = subject.instance
          .connect(charlie)
          [signature](alice.address, bob.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [alice.address, bob.address, tokenId]],
          ["TokenPrice", [tokenId, 0]],
        ]);
        await testTransferredTo(bob.address);
        tx = subject.instance
          .connect(bob)
          .transferFrom(bob.address, alice.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [bob.address, alice.address, tokenId]],
        ]);
      });

      it("should work with approved all", async () => {
        await subject.instance
          .connect(alice)
          .setApprovalForAll(charlie.address, true);
        let tx = subject.instance
          .connect(charlie)
          [signature](alice.address, bob.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [alice.address, bob.address, tokenId]],
          ["TokenPrice", [tokenId, 0]],
        ]);
        await testTransferredTo(bob.address);
        tx = subject.instance
          .connect(bob)
          .transferFrom(bob.address, alice.address, tokenId);
        await assertEvents(subject.instance, tx, [
          ["Transfer", [bob.address, alice.address, tokenId]],
        ]);
      });

      it("should revert with contract owner", async () => {
        await expect(
          subject.instance[signature](alice.address, bob.address, tokenId)
        ).to.be.revertedWith("caller is not the token owner or the approved");
      });

      describe("checkOnERC721Received", () => {
        it("should work with valid ERC721Receiver", async () => {
          const contract = await deployERC721Receiver();
          await subject.instance
            .connect(alice)
            [signatureWithData](
              alice.address,
              contract.instance.address,
              tokenId,
              "0x"
            );
          testTransferredTo(contract.instance.address);
        });

        it("should revert with invalid ERC721Receiver return value", async () => {
          const contract = await deployERC721Receiver();
          await expect(
            subject.instance
              .connect(alice)
              [signatureWithData](
                alice.address,
                contract.instance.address,
                tokenId,
                "0x00"
              )
          ).to.be.revertedWith("transfer to non ERC721Receiver implementer");
        });

        it("should revert from revert of ERC721Receiver", async () => {
          const contract = await deployERC721Receiver();
          await expect(
            subject.instance
              .connect(alice)
              [signatureWithData](
                alice.address,
                contract.instance.address,
                tokenId,
                "0x0000"
              )
          ).to.be.revertedWith("DebugERC721Receiver: reverted");
        });

        it("should revert without ERC721Receiver", async () => {
          const contract = await ethers.getContractFactory("NonERC721Receiver");
          const instance = await contract.deploy();
          await expect(
            subject.instance
              .connect(alice)
              [signature](alice.address, instance.address, tokenId)
          ).to.be.revertedWith("transfer to non ERC721Receiver implementer");
        });
      });
    });
  });
});
