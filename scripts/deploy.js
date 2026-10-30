const hre = require("hardhat");

async function main() {
  console.log("Deploying CertificateRegistry (OpenZeppelin AccessControl) to Sepolia...");
  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy();
  const deploymentTx = registry.deploymentTransaction();
  console.log("Deployment Transaction Hash:", deploymentTx ? deploymentTx.hash : "N/A");

  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log("CertificateRegistry deployed to:", address);
  console.log("Etherscan Link: https://sepolia.etherscan.io/address/" + address);
  if (deploymentTx) {
    console.log("Etherscan Tx Link: https://sepolia.etherscan.io/tx/" + deploymentTx.hash);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
