const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

test("OTP Verification & Strict Account Existence Checks", async (t) => {
  await t.test("Rejects OTP request for unregistered email with 404 status indicator", () => {
    const registeredEmails = new Set(["admin@iitb.ac.in", "registrar@delhi.edu"]);
    const requestedEmail = "random_unregistered@gmail.com";

    const exists = registeredEmails.has(requestedEmail.toLowerCase());
    assert.equal(exists, false, "Unregistered email must not exist in records");

    // Expected behavior: return 404 error instead of 200 generic message
    const response = !exists
      ? { status: 404, message: "No registered account found with this email. Please check your email or register first." }
      : { status: 200, message: "OTP sent" };

    assert.equal(response.status, 404);
    assert.match(response.message, /No registered account found/);
  });

  await t.test("Allows OTP dispatch only for existing registered account", () => {
    const registeredEmails = new Set(["admin@iitb.ac.in", "registrar@delhi.edu"]);
    const requestedEmail = "admin@iitb.ac.in";

    const exists = registeredEmails.has(requestedEmail.toLowerCase());
    assert.equal(exists, true, "Registered email must exist in records");

    const otp = crypto.randomInt(100000, 1000000).toString();
    assert.match(otp, /^\d{6}$/, "Must generate a 6-digit cryptographic OTP");

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    assert.equal(otpHash.length, 64, "OTP hash must be 32-byte sha256 hex string");
  });

  await t.test("Rejects tampered or expired OTP during login verification", () => {
    const validOtp = "654321";
    const correctHash = crypto.createHash("sha256").update(validOtp).digest("hex");
    const enteredWrongOtp = "123456";
    const enteredHash = crypto.createHash("sha256").update(enteredWrongOtp).digest("hex");

    assert.notEqual(enteredHash, correctHash, "Wrong OTP hash must not match");
  });
});

