const test = require("node:test");
const assert = require("node:assert/strict");
const { isIPFSEnabled } = require("../utils/ipfs");

test("IPFS upload remains opt-in unless explicitly enabled", () => {
  const previous = process.env.IPFS_ENABLED;
  try {
    delete process.env.IPFS_ENABLED;
    assert.equal(isIPFSEnabled(), false);
    process.env.IPFS_ENABLED = "true";
    assert.equal(isIPFSEnabled(), true);
    process.env.IPFS_ENABLED = "1";
    assert.equal(isIPFSEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.IPFS_ENABLED;
    else process.env.IPFS_ENABLED = previous;
  }
});
