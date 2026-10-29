require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    // Local test network — run `npx hardhat node` in a separate terminal first
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // Sepolia testnet — fill values in .env if you want a public testnet deployment
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
