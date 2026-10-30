const test = require("node:test");
const assert = require("node:assert/strict");
const { ethers } = require("ethers");

test("Three distinct stakeholder wallets can cryptographically sign challenges", async () => {
  // 1. Create 3 distinct stakeholder wallets
  const instituteWallet = ethers.Wallet.createRandom();
  const studentWallet = ethers.Wallet.createRandom();
  const employerWallet = ethers.Wallet.createRandom();

  // Confirm all three addresses are strictly distinct
  assert.notEqual(instituteWallet.address, studentWallet.address);
  assert.notEqual(studentWallet.address, employerWallet.address);
  assert.notEqual(instituteWallet.address, employerWallet.address);

  // 2. Simulate challenge generation for each stakeholder
  const generateChallenge = (wallet, role) => {
    const nonce = Math.random().toString(36).substring(2, 15);
    const timestamp = new Date().toISOString();
    return `CertChain Sepolia Authentication\n\nRole: ${role}\nWallet: ${wallet.address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  };

  const instituteChallenge = generateChallenge(instituteWallet, "institute");
  const studentChallenge = generateChallenge(studentWallet, "student");
  const employerChallenge = generateChallenge(employerWallet, "employer");

  // 3. Each stakeholder signs their respective challenge with their private key
  const instituteSig = await instituteWallet.signMessage(instituteChallenge);
  const studentSig = await studentWallet.signMessage(studentChallenge);
  const employerSig = await employerWallet.signMessage(employerChallenge);

  // 4. Verify cryptographic signature recovery
  const recoveredInstitute = ethers.verifyMessage(instituteChallenge, instituteSig);
  const recoveredStudent = ethers.verifyMessage(studentChallenge, studentSig);
  const recoveredEmployer = ethers.verifyMessage(employerChallenge, employerSig);

  assert.equal(recoveredInstitute.toLowerCase(), instituteWallet.address.toLowerCase());
  assert.equal(recoveredStudent.toLowerCase(), studentWallet.address.toLowerCase());
  assert.equal(recoveredEmployer.toLowerCase(), employerWallet.address.toLowerCase());
});

test("Rejects forged signature where an attacker signs for another wallet", async () => {
  const victimWallet = ethers.Wallet.createRandom();
  const attackerWallet = ethers.Wallet.createRandom();

  const challenge = `CertChain Sepolia Authentication\n\nRole: student\nWallet: ${victimWallet.address}\nNonce: 12345`;

  // Attacker signs the challenge intended for victim
  const attackerSig = await attackerWallet.signMessage(challenge);

  // Verification must recover attacker's address, which does NOT match victim
  const recovered = ethers.verifyMessage(challenge, attackerSig);
  assert.equal(recovered.toLowerCase(), attackerWallet.address.toLowerCase());
  assert.notEqual(recovered.toLowerCase(), victimWallet.address.toLowerCase());
});

