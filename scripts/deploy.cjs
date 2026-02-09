const hre = require("hardhat");

async function main() {
  // 根据网络选择 USDC 合约地址
  const network = hre.network.name;
  let USDC_ADDRESS;

  if (network === "base") {
    // Base 主网 USDC (Circle 官方)
    USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  } else if (network === "baseSepolia") {
    // Base Sepolia 测试网 USDC
    USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  console.log(`\nDeploying to ${network}...`);
  console.log(`USDC Address: ${USDC_ADDRESS}`);

  // 获取部署者账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 获取账户余额
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // 部署 USDCPaymaster 合约
  console.log("\nDeploying USDCPaymaster...");
  
  const USDCPaymaster = await hre.ethers.getContractFactory("USDCPaymaster");
  const paymaster = await USDCPaymaster.deploy(
    USDC_ADDRESS,      // USDC 合约地址
    deployer.address   // Owner 地址 (Relayer EOA)
  );

  await paymaster.waitForDeployment();
  const paymasterAddress = await paymaster.getAddress();

  console.log("\n✅ USDCPaymaster deployed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract Address:", paymasterAddress);
  console.log("USDC Address:    ", USDC_ADDRESS);
  console.log("Owner Address:   ", deployer.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n📝 Next steps:");
  console.log("1. Update PAYMASTER_ADDRESS in index.js:");
  console.log(`   const PAYMASTER_ADDRESS = '${paymasterAddress}'`);
  console.log("\n2. Update RELAYER_ADDRESS in frontend config:");
  console.log(`   export const RELAYER_ADDRESS = '${paymasterAddress}'`);
  console.log("\n3. Verify contract on BaseScan:");
  console.log(`   npx hardhat verify --network ${network} ${paymasterAddress} ${USDC_ADDRESS} ${deployer.address}`);

  return paymasterAddress;
}

main()
  .then((address) => {
    console.log("\n🎉 Deployment completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

