require("@nomicfoundation/hardhat-toolbox");
require("dotenv/config");

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
    // 以太坊主网
    mainnet: {
      url: process.env.RPC_URL || "https://eth.llamarpc.com",
      accounts: process.env.RELAYER_PRIVATE_KEY 
        ? [process.env.RELAYER_PRIVATE_KEY] 
        : [],
      chainId: 1,
    },
    // 本地测试网络
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    // 用于合约验证
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

