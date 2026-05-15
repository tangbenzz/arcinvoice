const hre = require("hardhat");

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;

  if (!usdcAddress) {
    throw new Error("Missing USDC_ADDRESS in contracts/.env");
  }

  const ArcInvoice = await hre.ethers.getContractFactory("ArcInvoice");
  const contract = await ArcInvoice.deploy(usdcAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("");
  console.log("====================================");
  console.log(" ArcInvoice deployed");
  console.log("====================================");
  console.log(` Network:  ${hre.network.name}`);
  console.log(` USDC:     ${usdcAddress}`);
  console.log(` Address:  ${address}`);
  console.log("====================================");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
