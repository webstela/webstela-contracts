import type {HardhatUserConfig, NetworksUserConfig} from "hardhat/types";

import dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";

let networks: NetworksUserConfig | undefined;
let etherscan: {apiKey?: string} | undefined;

const gasReporterEnabled = process.env.GAS_REPORTER;
const network = process.env.TARGET_NETWORK;
if (network) {
  dotenv.config({path: `.env.${network}`});
  networks = {
    [network]: {
      accounts: [process.env.ETH_PK!],
      url: `https://${network}.infura.io/v3/${process.env.INFURA_KEY}`,
    },
  };
  etherscan = {
    apiKey: process.env.ETHERSCAN_KEY,
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: {
    enabled: !!gasReporterEnabled,
  },
  defaultNetwork: "hardhat",
  networks,
  etherscan,
};

export default config;
