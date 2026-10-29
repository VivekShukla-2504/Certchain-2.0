const test = require("node:test");
const assert = require("node:assert/strict");
const { requireRole } = require("../middleware/auth");

function runRoleCheck(role, allowedRoles) {
  const result = { status: 200, body: null, next: false };
  const req = { institution: role ? { role } : null };
  const res = {
    status(status) {
      result.status = status;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  requireRole(...allowedRoles)(req, res, () => { result.next = true; });
  return result;
}

test("admin and issuer can use issuance permissions", () => {
  assert.equal(runRoleCheck("admin", ["admin", "issuer"]).next, true);
  assert.equal(runRoleCheck("issuer", ["admin", "issuer"]).next, true);
});

test("reviewer and unauthenticated requests are denied write permissions", () => {
  assert.equal(runRoleCheck("reviewer", ["admin", "issuer"]).status, 403);
  assert.equal(runRoleCheck(null, ["admin"]).status, 403);
});