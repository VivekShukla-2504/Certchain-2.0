require("dotenv").config();
const crypto = require("crypto");

let ipfsClient;

function isIPFSEnabled() {
  return process.env.IPFS_ENABLED === "true";
}

function ipfsProvider() {
  const provider = process.env.IPFS_PROVIDER || "kubo";
  if (provider !== "kubo" && provider !== "pinata") {
    throw new Error("IPFS_PROVIDER must be either kubo or pinata");
  }
  return provider;
}

function encryptionKey() {
  const value = process.env.IPFS_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("IPFS_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hexadecimal characters");
  }
  return Buffer.from(value, "hex");
}

function encryptForIPFS(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return {
    encryptedBuffer,
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
    encryptionVersion: 1
  };
}

function decryptFromIPFS(buffer, { iv, authTag, encryptionVersion }) {
  if (encryptionVersion !== 1 || !/^[a-f0-9]{24}$/i.test(iv || "") || !/^[a-f0-9]{32}$/i.test(authTag || "")) {
    throw new Error("IPFS encryption metadata is invalid or unsupported");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

async function getIpfsClient() {
  if (!ipfsClient) {
    const { create } = await import("kubo-rpc-client");
    const headers = { Origin: process.env.IPFS_ORIGIN || "http://localhost:3000" };
    if (process.env.IPFS_API_TOKEN) headers.Authorization = `Bearer ${process.env.IPFS_API_TOKEN}`;
    ipfsClient = create({
      url: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
      headers
    });
  }
  return ipfsClient;
}

function pinataToken() {
  const token = process.env.IPFS_API_TOKEN;
  if (!token) throw new Error("IPFS_API_TOKEN is required when IPFS_PROVIDER=pinata");
  return token;
}

async function uploadToPinata(buffer) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/octet-stream" }), "encrypted-certificate.bin");
  form.append("network", "public");
  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataToken()}` },
    body: form
  });
  if (!response.ok) {
    throw new Error(`Pinata upload failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const cid = payload?.data?.cid;
  if (typeof cid !== "string" || !cid) {
    throw new Error("Pinata upload response did not include a CID");
  }
  return cid;
}

async function downloadFromPinata(cid) {
  const gateway = (process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs").replace(/\/$/, "");
  const response = await fetch(`${gateway}/${encodeURIComponent(cid)}`);
  if (!response.ok) {
    throw new Error(`IPFS gateway download failed with HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function uploadToIPFS(buffer) {
  if (ipfsProvider() === "pinata") return uploadToPinata(buffer);
  const client = await getIpfsClient();
  const result = await client.add(buffer, { pin: true });
  return result.cid.toString();
}

async function downloadFromIPFS(cid) {
  if (ipfsProvider() === "pinata") return downloadFromPinata(cid);
  const client = await getIpfsClient();
  const chunks = [];
  for await (const chunk of client.cat(cid)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = {
  isIPFSEnabled,
  encryptForIPFS,
  decryptFromIPFS,
  uploadToIPFS,
  downloadFromIPFS
};
