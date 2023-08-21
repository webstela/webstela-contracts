import {expect} from "chai";
import {ethers} from "hardhat";

import {deploy, SignerWithAddress} from "./common/helper";

describe("hashable", () => {
  let subject: Awaited<ReturnType<typeof deploy>>;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let namespace: string;
  let hashed: string;
  const price = ethers.utils.parseEther("0.02");
  const tokenId = 1;

  beforeEach(async () => {
    subject = await deploy();
    creator = subject.users[0];
    owner = subject.users[1];

    const bytes = ethers.utils.toUtf8Bytes("foo", "NFC" as any);
    namespace = ethers.utils.hexlify(bytes);
    hashed = ethers.utils.sha256(bytes);

    await subject.instance.mintByManager(
      hashed,
      ethers.constants.HashZero,
      creator.address,
      owner.address,
      0,
      price
    );
  });

  describe("getters", () => {
    let invalidHashed: string;

    beforeEach(async () => {
      invalidHashed = ethers.utils
        .hexlify(ethers.utils.toUtf8Bytes("invalid", "NFC" as any))
        .padEnd(66, "0");
    });

    describe("tokenIdOf", () => {
      it("should work", async () => {
        expect(await subject.instance.tokenIdOf(hashed)).equals(tokenId);
      });

      it("should return zero for invalid hashed", async () => {
        expect(await subject.instance.tokenIdOf(invalidHashed)).equals(
          ethers.constants.HashZero
        );
      });

      it("should return zero for hash zero", async () => {
        expect(
          await subject.instance.tokenIdOf(ethers.constants.HashZero)
        ).equals(ethers.constants.HashZero);
      });
    });

    describe("ownerOf", () => {
      it("should work", async () => {
        expect(await subject.instance["ownerOf(bytes32)"](hashed)).equals(
          owner.address
        );
      });

      it("should return zero for invalid hashed", async () => {
        expect(
          await subject.instance["ownerOf(bytes32)"](invalidHashed)
        ).equals(ethers.constants.AddressZero);
      });

      it("should return zero for hash zero", async () => {
        expect(
          await subject.instance["ownerOf(bytes32)"](ethers.constants.HashZero)
        ).equals(ethers.constants.AddressZero);
      });
    });

    describe("royaltyHolderOf", () => {
      it("should work", async () => {
        expect(await subject.instance.royaltyHolderOf(tokenId)).equals(
          creator.address
        );
      });

      it("should return zero for invalid hashed", async () => {
        expect(await subject.instance.royaltyHolderOf(invalidHashed)).equals(
          ethers.constants.AddressZero
        );
      });

      it("should return zero for hash zero", async () => {
        expect(
          await subject.instance.royaltyHolderOf(ethers.constants.HashZero)
        ).equals(ethers.constants.AddressZero);
      });
    });

    describe("priceOf", () => {
      it("should work", async () => {
        expect(await subject.instance.priceOf(tokenId)).equals(price);
      });

      it("should return zero for invalid hashed", async () => {
        expect(await subject.instance.priceOf(invalidHashed)).equals(0);
      });

      it("should return zero for hash zero", async () => {
        expect(
          await subject.instance.priceOf(ethers.constants.HashZero)
        ).equals(0);
      });
    });
  });

  describe("hashOf", () => {
    it("should work", async () => {
      expect(await subject.instance.hashOf(tokenId)).equals(hashed);
    });

    it("should return zero for invalid tokenId", async () => {
      expect(await subject.instance.hashOf(999)).equals(
        ethers.constants.HashZero
      );
    });

    it("should return zero for zero tokenId", async () => {
      expect(await subject.instance.hashOf(0)).equals(
        ethers.constants.HashZero
      );
    });
  });

  describe("namespaceOf", () => {
    it("should work", async () => {
      await subject.instance
        .connect(owner)
        .setTokenNamespace(tokenId, namespace);
      expect(await subject.instance.namespaceOf(tokenId)).equals(
        namespace.padEnd(66, "0")
      );
    });

    it("should return zero for unset namespaced token", async () => {
      expect(await subject.instance.namespaceOf(tokenId)).equals(
        ethers.constants.HashZero
      );
    });

    it("should return zero for zero tokenId", async () => {
      expect(await subject.instance.namespaceOf(0)).equals(
        ethers.constants.HashZero
      );
    });
  });

  describe("setTokenNamespace", () => {
    it("should work with events", async () => {
      const bytes = ethers.utils.toUtf8Bytes("foo", "NFC" as any);
      const namespace = ethers.utils.hexlify(bytes);
      await expect(
        subject.instance.connect(owner).setTokenNamespace(tokenId, namespace)
      )
        .emit(subject.instance, "TokenNamespace")
        .withArgs(tokenId, namespace.padEnd(66, "0"));
    });

    it("should revert with too long namespace", async () => {
      await expect(
        subject.instance
          .connect(owner)
          .setTokenNamespace(tokenId, namespace.padEnd(68, "30"))
      ).revertedWith("invalid namespace length");
    });

    it("should work with only lowercased alphanumeric", async () => {
      const namespaces = [
        ethers.utils.toUtf8Bytes(
          "0123456789abcdefghijklmnopqrstuv",
          "NFC" as any
        ),
        ethers.utils.toUtf8Bytes(
          "abcdefghijklmnopqrstuvwzyz456789",
          "NFC" as any
        ),
        ethers.utils.toUtf8Bytes("web_stela", "NFC" as any),
      ];
      const hashed = [
        ethers.utils.sha256(namespaces[0]),
        ethers.utils.sha256(namespaces[1]),
        ethers.utils.sha256(namespaces[2]),
      ];

      await subject.instance.mintBatchByManager(
        hashed,
        ethers.constants.HashZero,
        creator.address,
        owner.address,
        0,
        [0, 0, 0]
      );

      let tokenId = 2;
      let namespace = ethers.utils.hexlify(namespaces[0]);
      await expect(
        subject.instance.connect(owner).setTokenNamespace(tokenId, namespace)
      )
        .emit(subject.instance, "TokenNamespace")
        .withArgs(tokenId, namespace.padEnd(66, "0"));

      tokenId = 3;
      namespace = ethers.utils.hexlify(namespaces[1]);
      await expect(
        subject.instance.connect(owner).setTokenNamespace(tokenId, namespace)
      )
        .emit(subject.instance, "TokenNamespace")
        .withArgs(tokenId, namespace.padEnd(66, "0"));

      tokenId = 4;
      namespace = ethers.utils.hexlify(namespaces[2]);
      await expect(
        subject.instance
          .connect(owner)
          .setTokenNamespace(tokenId, namespace.padEnd(68, "30"))
      ).revertedWith("invalid namespace - only lowercased alphanumeric");
    });
  });

  describe("unsafeSetTokenNamespace", () => {
    it("should work with events", async () => {
      await expect(
        subject.instance
          .connect(subject.manager)
          .unsafeSetTokenNamespace(tokenId, namespace)
      )
        .emit(subject.instance, "TokenNamespace")
        .withArgs(tokenId, namespace.padEnd(66, "0"));
    });

    it("should revert without manager", async () => {
      await expect(
        subject.instance
          .connect(owner)
          .unsafeSetTokenNamespace(tokenId, namespace)
      ).revertedWith("caller is not the manager");
    });

    it("should revert with invalid token", async () => {
      const bytes = ethers.utils.toUtf8Bytes("webstela.com", "NFC" as any);
      const namespace = ethers.utils.sha256(bytes);

      await expect(
        subject.instance
          .connect(subject.manager)
          .unsafeSetTokenNamespace(tokenId, namespace)
      ).revertedWith("invalid namespace hash");
    });

    it("should set any namespace", async () => {
      const namespace = ethers.utils.toUtf8Bytes("webstela.com", "NFC" as any);
      const hashed = ethers.utils.sha256(namespace);

      await subject.instance.mintByManager(
        hashed,
        ethers.constants.HashZero,
        creator.address,
        owner.address,
        0,
        0
      );

      const tokenId = 2;
      const hex = ethers.utils.hexlify(namespace);
      await expect(
        subject.instance
          .connect(subject.manager)
          .unsafeSetTokenNamespace(tokenId, hex)
      )
        .emit(subject.instance, "TokenNamespace")
        .withArgs(tokenId, hex.padEnd(66, "0"));
    });
  });

  describe("setAccountName", () => {
    it("should work with events", async () => {
      expect(await subject.instance.nameOf(owner.address)).equals(
        ethers.constants.HashZero
      );

      await subject.instance
        .connect(owner)
        .setTokenNamespace(tokenId, namespace);

      await expect(subject.instance.connect(owner).setAccountName(tokenId))
        .emit(subject.instance, "AccountName")
        .withArgs(owner.address, namespace.padEnd(66, "0"));

      expect(await subject.instance.nameOf(owner.address)).equals(
        namespace.padEnd(66, "0")
      );
    });

    it("should revert without token owner", async () => {
      expect(await subject.instance.nameOf(owner.address)).equals(
        ethers.constants.HashZero
      );

      await expect(subject.instance.setAccountName(tokenId)).revertedWith(
        "caller is not the token owner"
      );
    });

    it("should revert with empty namespace", async () => {
      expect(await subject.instance.nameOf(owner.address)).equals(
        ethers.constants.HashZero
      );

      await expect(
        subject.instance.connect(owner).setAccountName(tokenId)
      ).revertedWith("invalid namespace");
    });

    it("should clear name when being transferred", async () => {
      await subject.instance
        .connect(owner)
        .setTokenNamespace(tokenId, namespace);
      await subject.instance.connect(owner).setAccountName(tokenId);
      expect(await subject.instance.nameOf(owner.address)).not.equals(
        ethers.constants.HashZero
      );
      await expect(
        subject.instance
          .connect(owner)
          .transferFrom(owner.address, subject.users[9].address, tokenId)
      )
        .emit(subject.instance, "AccountName")
        .withArgs(owner.address, ethers.constants.HashZero);
      expect(await subject.instance.nameOf(owner.address)).equals(
        ethers.constants.HashZero
      );
    });
  });

  describe("setTokenURI", () => {
    const customURI = "custom";

    it("should work with events", async () => {
      await expect(
        subject.instance.connect(owner).setTokenURI(tokenId, customURI)
      )
        .emit(subject.instance, "TokenURI")
        .withArgs(tokenId, customURI);
    });

    it("should work with empty uri", async () => {
      await expect(subject.instance.connect(owner).setTokenURI(tokenId, ""))
        .emit(subject.instance, "TokenURI")
        .withArgs(tokenId, "");
    });

    it("should revert without token owner", async () => {
      await expect(
        subject.instance.setTokenURI(tokenId, customURI)
      ).revertedWith("caller is not the token owner");
    });
  });

  describe("tokenURI", () => {
    const customURI = "custom";

    it("should return default uri", async () => {
      expect(await subject.instance.tokenURI(tokenId)).equals(
        `https://static.webstela.com/nft/${tokenId}`
      );
    });

    it("should return custom uri if exists", async () => {
      await subject.instance.connect(owner).setTokenURI(tokenId, customURI);

      expect(await subject.instance.tokenURI(tokenId)).equals(customURI);
    });

    it("should ignore empty custom uri", async () => {
      await subject.instance.connect(owner).setTokenURI(tokenId, customURI);
      expect(await subject.instance.tokenURI(tokenId)).equals(customURI);

      await subject.instance.connect(owner).setTokenURI(tokenId, "");

      expect(await subject.instance.tokenURI(tokenId)).equals(
        `https://static.webstela.com/nft/${tokenId}`
      );
    });
  });

  describe("setTokenRoyaltyHolder", () => {
    let to: SignerWithAddress;

    beforeEach(() => {
      to = subject.users[9];
    });

    it("should work with events", async () => {
      await expect(
        subject.instance
          .connect(creator)
          .setTokenRoyaltyHolder(tokenId, to.address)
      )
        .emit(subject.instance, "TokenRoyaltyHolder")
        .withArgs(tokenId, to.address);
    });

    it("should work with zero address", async () => {
      await expect(
        subject.instance
          .connect(creator)
          .setTokenRoyaltyHolder(tokenId, ethers.constants.AddressZero)
      )
        .emit(subject.instance, "TokenRoyaltyHolder")
        .withArgs(tokenId, ethers.constants.AddressZero);
    });

    it("should revert without royaltyHolder", async () => {
      await expect(
        subject.instance
          .connect(owner)
          .setTokenRoyaltyHolder(tokenId, to.address)
      ).revertedWith("caller is not the royalty holder");
    });
  });

  describe("setTokenPrice", () => {
    it("should work with events", async () => {
      const nextPrice = ethers.utils.parseEther("1");
      await expect(
        subject.instance.connect(owner).setTokenPrice(tokenId, nextPrice)
      )
        .emit(subject.instance, "TokenPrice")
        .withArgs(tokenId, nextPrice);
    });

    it("should work with zero price", async () => {
      await expect(subject.instance.connect(owner).setTokenPrice(tokenId, 0))
        .emit(subject.instance, "TokenPrice")
        .withArgs(tokenId, 0);
    });

    it("should revert without token owner", async () => {
      await expect(subject.instance.setTokenPrice(tokenId, 1)).revertedWith(
        "caller is not the token owner"
      );
    });

    it("should revert with too high price", async () => {
      const max = ethers.constants.MaxUint256.div(10000);
      await expect(
        subject.instance.connect(owner).setTokenPrice(tokenId, max.add(1))
      ).revertedWithPanic("0x11");
      await expect(subject.instance.connect(owner).setTokenPrice(tokenId, max))
        .emit(subject.instance, "TokenPrice")
        .withArgs(tokenId, max);
    });
  });
});
