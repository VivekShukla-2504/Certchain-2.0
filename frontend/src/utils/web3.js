import api from "../api";

export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
export const SEPOLIA_CHAIN_ID_DEC = 11155111;

/**
 * Checks if MetaMask or an EVM-compatible Web3 provider is present in the browser.
 */
export function hasMetaMask() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/**
 * Returns currently connected wallet address if authorized, or null.
 */
export async function getConnectedWallet() {
  if (hasMetaMask()) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      return accounts && accounts.length > 0 ? accounts[0] : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Checks if MetaMask is currently connected to Ethereum Sepolia.
 */
export async function isSepoliaNetwork() {
  if (!hasMetaMask()) return false;
  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    return chainId === SEPOLIA_CHAIN_ID_HEX;
  } catch {
    return false;
  }
}

/**
 * Ensures user's MetaMask wallet is switched to Ethereum Sepolia (Chain ID 11155111).
 */
export async function ensureSepoliaNetwork() {
  if (!hasMetaMask()) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID_HEX,
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
    } else {
      throw switchError;
    }
  }
}

/**
 * Requests MetaMask connection and switches to Sepolia.
 */
export async function connectMetaMaskWallet() {
  if (!hasMetaMask()) {
    throw new Error(
      "MetaMask extension not found in your browser. Please install MetaMask or paste your Sepolia address manually."
    );
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No Sepolia account selected in MetaMask.");
    }

    await ensureSepoliaNetwork();
    return accounts[0];
  } catch (err) {
    if (err.code === 4001) {
      throw new Error("MetaMask connection request cancelled by user.");
    }
    throw err;
  }
}

/**
 * Requests an EIP-191 personal_sign cryptographic signature from MetaMask.
 */
export async function signChallenge(challengeText, address) {
  if (!hasMetaMask()) {
    throw new Error("MetaMask not found.");
  }

  try {
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [challengeText, address]
    });
    return signature;
  } catch (err) {
    if (err.code === 4001) {
      throw new Error("Authentication signature was rejected in MetaMask.");
    }
    throw err;
  }
}

/**
 * Cryptographic challenge-response authentication for a stakeholder wallet.
 * 1. Connects wallet & ensures Sepolia network.
 * 2. Fetches server-generated challenge nonce.
 * 3. Prompts user to sign challenge in MetaMask.
 * 4. Submits signature to backend for cryptographic verification.
 * 5. Returns authenticated JWT session token.
 */
export async function authenticateStakeholderWallet(role = "institute") {
  const address = await connectMetaMaskWallet();

  // 1. Request cryptographic challenge
  const challengeRes = await api.get(`/auth/wallet-challenge?address=${encodeURIComponent(address)}&role=${encodeURIComponent(role)}`);
  const { challenge } = challengeRes.data;

  // 2. Sign with private key via MetaMask
  const signature = await signChallenge(challenge, address);

  // 3. Verify on backend
  const verifyRes = await api.post("/auth/wallet-verify", {
    walletAddress: address,
    signature,
    role
  });

  return {
    address,
    ...verifyRes.data
  };
}

/**
 * Disconnects local session state.
 */
export function disconnectWallet() {
  localStorage.removeItem("certchain_token");
  localStorage.removeItem("certchain_institution");
  localStorage.removeItem("certchain_stakeholder_wallet");
  localStorage.removeItem("certchain_stakeholder_role");
}
