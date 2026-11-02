import api from "../api";
import { BrowserProvider, JsonRpcProvider, Contract, ZeroHash } from "ethers";

export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
export const SEPOLIA_CHAIN_ID_DEC = 11155111;

export const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

export const CONTRACT_ABI = [
  "function verifyCertificate(string calldata certId, bytes32 certHash) external view returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked, address recipient, string memory ipfsCid)",
  "function verifyCredential(string calldata certId, bytes32 certHash) external view returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked, address recipient, string memory ipfsCid)",
  "function getRecord(string calldata certId) external view returns (tuple(bytes32 certHash, address issuer, address recipient, string institutionId, string ipfsCid, uint256 issuedAt, bool revoked))",
  "function getStudentCertificates(address student) external view returns (string[] memory)",
  "function isAuthorizedInstitute(address institute) external view returns (bool)",
  "function isVerificationApproved(string calldata certId, address employer) external view returns (bool)"
];

const PUBLIC_SEPOLIA_RPCS = [
  "https://rpc.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org"
];

/**
 * Returns an ethers Provider: uses window.ethereum if available, otherwise falls back to public Sepolia RPC.
 */
export function getSepoliaProvider() {
  if (hasMetaMask()) {
    try {
      return new BrowserProvider(window.ethereum);
    } catch {
      // Fallback to public RPC
    }
  }
  return new JsonRpcProvider(PUBLIC_SEPOLIA_RPCS[0]);
}

/**
 * 100% Trustless Direct-on-Chain Verification
 * Queries Ethereum Sepolia smart contract directly via EVM view call.
 * Operates completely independent of MongoDB or backend API servers.
 */
export async function verifyDirectOnChain(certId, docHashHex = "") {
  const cleanCertId = (certId || "").trim().toUpperCase();
  if (!cleanCertId) {
    throw new Error("Please specify a valid Certificate ID");
  }

  // Attempt RPC connections with resilient fallbacks
  let provider = null;
  if (hasMetaMask()) {
    try {
      provider = new BrowserProvider(window.ethereum);
    } catch {
      provider = null;
    }
  }

  let contract = null;
  let lastErr = null;

  const candidateProviders = provider ? [provider] : [];
  for (const rpc of PUBLIC_SEPOLIA_RPCS) {
    candidateProviders.push(new JsonRpcProvider(rpc));
  }

  for (const prov of candidateProviders) {
    try {
      contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, prov);
      const record = await contract.getRecord(cleanCertId);
      
      const exists = record && record.issuedAt > 0n;
      if (!exists) {
        return {
          found: false,
          certId: cleanCertId,
          message: `Certificate ID "${cleanCertId}" is not registered on Ethereum Sepolia.`,
          source: "Ethereum Sepolia Smart Contract"
        };
      }

      let bytes32Hash = ZeroHash;
      if (docHashHex) {
        const clean = docHashHex.startsWith("0x") ? docHashHex : "0x" + docHashHex;
        bytes32Hash = clean.padEnd(66, "0").slice(0, 66);
      }

      const isHashMatch = docHashHex
        ? record.certHash.toLowerCase() === bytes32Hash.toLowerCase()
        : null;

      const isRevoked = Boolean(record.revoked);
      let status = "VERIFIED_AUTHENTIC";
      if (isRevoked) {
        status = "REVOKED";
      } else if (isHashMatch === false) {
        status = "TAMPERED";
      }

      return {
        found: true,
        certId: cleanCertId,
        certHash: record.certHash,
        issuer: record.issuer,
        recipient: record.recipient,
        institutionId: record.institutionId,
        ipfsCid: record.ipfsCid,
        issuedAt: Number(record.issuedAt),
        issuedAtDate: new Date(Number(record.issuedAt) * 1000).toISOString(),
        revoked: isRevoked,
        isHashMatch,
        status,
        contractAddress: CONTRACT_ADDRESS,
        explorerUrl: `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`,
        source: "Ethereum Sepolia Smart Contract (Direct Trustless EVM Query)"
      };
    } catch (err) {
      lastErr = err;
      continue;
    }
  }

  throw new Error(lastErr?.message || "Failed to query Ethereum Sepolia nodes.");
}

/**
 * Direct EVM query for student's on-chain certificates
 */
export async function getStudentCertificatesDirect(studentAddress) {
  if (!studentAddress) return [];
  const prov = getSepoliaProvider();
  const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, prov);
  try {
    return await contract.getStudentCertificates(studentAddress);
  } catch {
    return [];
  }
}

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

export const switchToSepolia = ensureSepoliaNetwork;
export const requestWalletSignature = signChallenge;

