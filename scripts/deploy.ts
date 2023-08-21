import {ethers} from "hardhat";

async function main() {
  const manager = "0xe091133fBE05E6fc235c9780afA2bFcA6836F989";
  const Webstela = await ethers.getContractFactory("Webstela");
  const webstela = await Webstela.deploy(manager);
  await webstela.deployed();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
