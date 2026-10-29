const test = require("node:test");
const assert = require("node:assert/strict");
const { decryptFromIPFS, encryptForIPFS, uploadToIPFS, downloadFromIPFS } = require("../utils/ipfs");

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("IPFS encryption round-trips PDF bytes", () => {
  const previousKey = process.env.IPFS_ENCRYPTION_KEY;
  process.env.IPFS_ENCRYPTION_KEY = TEST_KEY;
  try {
    const source = Buffer.from("%PDF-1.7 test certificate");
    const encrypted = encryptForIPFS(source);
    const decrypted = decryptFromIPFS(encrypted.encryptedBuffer, encrypted);
    assert.deepEqual(decrypted, source);
    assert.notDeepEqual(encrypted.encryptedBuffer, source);
    assert.equal(encrypted.encryptionVersion, 1);
  } finally {
    if (previousKey === undefined) delete process.env.IPFS_ENCRYPTION_KEY;
    else process.env.IPFS_ENCRYPTION_KEY = previousKey;
  }
});

test("IPFS decryption rejects modified ciphertext", () => {
  const previousKey = process.env.IPFS_ENCRYPTION_KEY;
  process.env.IPFS_ENCRYPTION_KEY = TEST_KEY;
  try {
    const encrypted = encryptForIPFS(Buffer.from("%PDF-1.7 test certificate"));
    encrypted.encryptedBuffer[0] ^= 0xff;
    assert.throws(() => decryptFromIPFS(encrypted.encryptedBuffer, encrypted));
  } finally {
    if (previousKey === undefined) delete process.env.IPFS_ENCRYPTION_KEY;
    else process.env.IPFS_ENCRYPTION_KEY = previousKey;
  }
});

test("IPFS encryption requires a 32-byte hexadecimal key", () => {
  const previousKey = process.env.IPFS_ENCRYPTION_KEY;
  delete process.env.IPFS_ENCRYPTION_KEY;
  try {
    assert.throws(() => encryptForIPFS(Buffer.from("document")), /IPFS_ENCRYPTION_KEY/);
  } finally {
    if (previousKey !== undefined) process.env.IPFS_ENCRYPTION_KEY = previousKey;
  }
});

test("Pinata provider uploads encrypted content and retrieves it by CID", async () => {
  const previous = {
    provider: process.env.IPFS_PROVIDER,
    token: process.env.IPFS_API_TOKEN,
    gateway: process.env.IPFS_GATEWAY_URL,
    fetch: global.fetch
  };
  const requests = [];
  process.env.IPFS_PROVIDER = "pinata";
  process.env.IPFS_API_TOKEN = "test-pinata-token";
  process.env.IPFS_GATEWAY_URL = "https://gateway.example/ipfs";
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (options.method === "POST") {
      return { ok: true, json: async () => ({ data: { cid: "bafytestcid" } }) };
    }
    return { ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
  };

  try {
    const cid = await uploadToIPFS(Buffer.from("encrypted bytes"));
    const downloaded = await downloadFromIPFS(cid);
    assert.equal(cid, "bafytestcid");
    assert.deepEqual(downloaded, Buffer.from([1, 2, 3]));
    assert.equal(requests[0].url, "https://uploads.pinata.cloud/v3/files");
    assert.equal(requests[0].options.headers.Authorization, "Bearer test-pinata-token");
    assert.equal(requests[1].url, "https://gateway.example/ipfs/bafytestcid");
  } finally {
    global.fetch = previous.fetch;
    if (previous.provider === undefined) delete process.env.IPFS_PROVIDER;
    else process.env.IPFS_PROVIDER = previous.provider;
    if (previous.token === undefined) delete process.env.IPFS_API_TOKEN;
    else process.env.IPFS_API_TOKEN = previous.token;
    if (previous.gateway === undefined) delete process.env.IPFS_GATEWAY_URL;
    else process.env.IPFS_GATEWAY_URL = previous.gateway;
  }
});
