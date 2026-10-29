const crypto = require("crypto");
const { hashCertificateData } = require("./hash");

const PREPARATION_TTL_MS = 10 * 60 * 1000;

function preparationPayload({ certId, institutionId, fields, expiresAt }) {
  return JSON.stringify({
    certId,
    institutionId,
    expiresAt,
    fieldsHash: hashCertificateData({ ...fields, institutionId })
  });
}

function signPreparedCertificate(claims) {
  const expiresAt = Date.now() + PREPARATION_TTL_MS;
  const payload = preparationPayload({ ...claims, expiresAt });
  const token = crypto.createHmac("sha256", process.env.JWT_SECRET).update(payload).digest("hex");
  return { token, expiresAt };
}

function verifyPreparedCertificate({ token, expiresAt, ...claims }) {
  if (typeof token !== "string" || !Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", process.env.JWT_SECRET)
    .update(preparationPayload({ ...claims, expiresAt: Number(expiresAt) }))
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

module.exports = { signPreparedCertificate, verifyPreparedCertificate, PREPARATION_TTL_MS };
