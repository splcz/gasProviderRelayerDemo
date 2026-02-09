require("dotenv/config");
require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Base 主网
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.RELAYER_PRIVATE_KEY 
        ? [process.env.RELAYER_PRIVATE_KEY] 
        : [],
      chainId: 8453,
    },
    // Base Sepolia 测试网
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.RELAYER_PRIVATE_KEY 
        ? [process.env.RELAYER_PRIVATE_KEY] 
        : [],
      chainId: 84532,
      timeout: 60000,
    },
    // 本地测试网络
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.ETHERSCAN_API_KEY || "",
      baseSepolia: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
