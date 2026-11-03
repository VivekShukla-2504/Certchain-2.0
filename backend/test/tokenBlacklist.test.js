const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { blacklistToken, isTokenBlacklisted, requireAuth } = require("../middleware/auth");

test("Token Blacklist & JWT Security Verification", async (t) => {
  const secret = process.env.JWT_SECRET || "410d4c5cd89ec92e2169894a1af55e33e32d262fafe718274a3be497f52ca9cc";
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
});
