import {ethers} from "hardhat";

export const deploy = async (name: string, ...params: any[]) => {
  const accounts = await ethers.getSigners();
  const [owner, other] = accounts;

  const contract = await ethers.getContractFactory(name);
  const instance = await contract.deploy(...params);

  return {instance, owner, other, accounts};
};
