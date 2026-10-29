/**
 * Ethereum Sepolia Web3 & MetaMask Helper Utility
 * Connects directly to the user's authentic Sepolia wallet address
 */

export async function connectMetaMaskWallet() {
  if (typeof window !== "undefined" && window.ethereum) {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No Sepolia account selected in MetaMask.");
      }

      // Check / switch network to Ethereum Sepolia (Chain ID 11155111 = 0xaa36a7)
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }]
        });
      } catch (switchError) {
        // If chain 11155111 hasn't been added yet, add it
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xaa36a7",
                  chainName: "Sepolia Testnet",
                  nativeCurrency: {
                    name: "Sepolia ETH",
                    symbol: "ETH",
                    decimals: 18
                  },
                  rpcUrls: ["https://rpc.sepolia.org"]
                }
              ]
            });
          } catch (addError) {
            console.warn("Could not auto-add Sepolia chain:", addError);
          }
        }
      }

      return accounts[0];
    } catch (err) {
      if (err.code === 4001) {
        throw new Error("MetaMask connection request cancelled.");
      }
      throw err;
    }
  } else {
    throw new Error("MetaMask extension not found in your browser. Please install MetaMask or paste your Sepolia address manually.");
  }
}

