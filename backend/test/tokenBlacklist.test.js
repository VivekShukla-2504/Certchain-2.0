const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const TokenBlacklist = require("../models/TokenBlacklist");
const { blacklistToken, isTokenBlacklisted, requireAuth, requireStakeholderAuth } = require("../middleware/auth");

test("Token Blacklist & JWT Security Verification", async (t) => {
  const secret = "test-only-jwt-secret";
  const originalSecret = process.env.JWT_SECRET;
  const originalFindOne = TokenBlacklist.findOne;
  const originalFindOneAndUpdate = TokenBlacklist.findOneAndUpdate;
  const persistedTokens = new Map();
  process.env.JWT_SECRET = secret;

  TokenBlacklist.findOne = ({ token }) => ({
    lean: async () => persistedTokens.get(token) || null
  });
  TokenBlacklist.findOneAndUpdate = async ({ token }, update) => {
    persistedTokens.set(token, update);
    return update;
  };
  t.after(() => {
    TokenBlacklist.findOne = originalFindOne;
    TokenBlacklist.findOneAndUpdate = originalFindOneAndUpdate;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  const dummyToken = jwt.sign(
    { institutionId: "TEST_INST", role: "admin" },
    secret,
    { expiresIn: "1h" }
  );

  await t.test("Freshly minted token is not blacklisted", async () => {
    const blacklisted = await isTokenBlacklisted(dummyToken);
    assert.equal(blacklisted, false);
  });

  await t.test("Blacklisting token marks it as revoked immediately", async () => {
    await blacklistToken(dummyToken);
    const blacklisted = await isTokenBlacklisted(dummyToken);
    assert.equal(blacklisted, true);
  });

  await t.test("requireAuth rejects blacklisted token with 401 status", async () => {
    const req = {
      headers: {
        authorization: `Bearer ${dummyToken}`
      }
    };
    let statusCode = 0;
    let responseBody = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAuth(req, res, next);
    assert.equal(statusCode, 401);
    assert.match(responseBody.message, /revoked or logged out/i);
    assert.equal(nextCalled, false);
  });

  await t.test("requireAuth rejects missing or malformed token", async () => {
    const req = {
      headers: {
        authorization: "InvalidFormat"
      }
    };
    let statusCode = 0;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      }
    };
    let nextCalled = false;
    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(statusCode, 401);
    assert.equal(nextCalled, false);
  });

  await t.test("Blacklist lookup failure fails closed", async () => {
    TokenBlacklist.findOne = () => ({
      lean: async () => { throw new Error("database unavailable"); }
    });
    const req = { headers: { authorization: `Bearer ${jwt.sign({ role: "admin" }, secret, { expiresIn: "1h" })}` } };
    let statusCode = 0;
    let nextCalled = false;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      }
    };

    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(statusCode, 503);
    assert.equal(nextCalled, false);
  });

  await t.test("Blacklist write failure is surfaced", async () => {
    TokenBlacklist.findOneAndUpdate = async () => {
      throw new Error("database unavailable");
    };
    const token = jwt.sign({ role: "employer" }, secret, { expiresIn: "1h" });
    await assert.rejects(blacklistToken(token), /database unavailable/);
  });

  await t.test("Stakeholder middleware requires a signed, non-revoked employer session", async () => {
    TokenBlacklist.findOne = ({ token }) => ({
      lean: async () => persistedTokens.get(token) || null
    });
    const token = jwt.sign(
      { walletAddress: "0x0000000000000000000000000000000000000001", role: "employer", verifiedBySignature: true },
      secret,
      { expiresIn: "1h" }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nextCalled = false;
    await requireStakeholderAuth("employer")(req, {
      status(code) {
        assert.fail(`Unexpected status ${code}`);
      },
      json() {
        assert.fail("Unexpected authorization failure");
      }
    }, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.stakeholder.walletAddress, "0x0000000000000000000000000000000000000001");
  });
});
