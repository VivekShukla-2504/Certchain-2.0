const { expect } = require("chai");
const anyValue = require("@nomicfoundation/hardhat-chai-matchers/withArgs").anyValue;

describe("CertificateRegistry", function () {
  async function deployFixture() {
    const [owner, issuer, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    return { registry, owner, issuer, other };
  }

  const certificateHash = () => ethers.keccak256(ethers.toUtf8Bytes("certificate-data"));

  it("allows an authorized issuer to issue a certificate", async function () {
    const { registry, owner, issuer } = await deployFixture();
    await registry.connect(owner).authorizeIssuer(issuer.address, "INST-A");

    await expect(registry.connect(issuer).issueCertificate("CERT-001", certificateHash(), "INST-A"))
      .to.emit(registry, "CertificateIssued")
      .withArgs("CERT-001", certificateHash(), issuer.address, issuer.address, anyValue);
  });

  it("rejects issuance by an unauthorized issuer", async function () {
    const { registry, other } = await deployFixture();
    await expect(registry.connect(other).issueCertificate("CERT-002", certificateHash(), "INST-A"))
      .to.be.revertedWith("Not an authorized issuer");
  });

  it("rejects duplicate certificate IDs", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).issueCertificate("CERT-003", certificateHash(), "OWNER");

    await expect(registry.connect(owner).issueCertificate("CERT-003", certificateHash(), "OWNER"))
      .to.be.revertedWith("Certificate ID already exists");
  });

  it("verifies a certificate with the correct hash", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).issueCertificate("CERT-004", certificateHash(), "OWNER");

    const result = await registry.verifyCertificate("CERT-004", certificateHash());
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(owner.address);
    expect(result[2]).to.equal("OWNER");
    expect(result[4]).to.equal(false);
  });

  it("returns invalid for a missing or incorrect certificate", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).issueCertificate("CERT-005", certificateHash(), "OWNER");

    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-data"));
    const mismatch = await registry.verifyCertificate("CERT-005", wrongHash);
    const missing = await registry.verifyCertificate("CERT-MISSING", certificateHash());
    expect(mismatch[0]).to.equal(false);
    expect(missing[0]).to.equal(false);
  });

  it("allows the issuing wallet to revoke a certificate", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).issueCertificate("CERT-006", certificateHash(), "OWNER");

    await expect(registry.connect(owner).revokeCertificate("CERT-006"))
      .to.emit(registry, "CertificateRevoked")
      .withArgs("CERT-006", owner.address);
    const result = await registry.verifyCertificate("CERT-006", certificateHash());
    expect(result[0]).to.equal(false);
    expect(result[4]).to.equal(true);
  });

  it("rejects revocation by an unauthorized wallet", async function () {
    const { registry, owner, other } = await deployFixture();
    await registry.connect(owner).issueCertificate("CERT-007", certificateHash(), "OWNER");

    await expect(registry.connect(other).revokeCertificate("CERT-007"))
      .to.be.revertedWith("Not authorized to revoke");
  });

  it("rejects invalid certificate input", async function () {
    const { registry, owner } = await deployFixture();
    await expect(registry.connect(owner).issueCertificate("", certificateHash(), "OWNER"))
      .to.be.revertedWith("Certificate ID cannot be empty");
    await expect(registry.connect(owner).issueCertificate("CERT-008", ethers.ZeroHash, "OWNER"))
      .to.be.revertedWith("Hash cannot be empty");
  });

  it("allows the current owner to initiate a two-step ownership transfer", async function () {
    const { registry, owner, other } = await deployFixture();

    await expect(registry.connect(owner).transferOwnership(other.address))
      .to.emit(registry, "OwnershipTransferStarted")
      .withArgs(owner.address, other.address);
    expect(await registry.pendingOwner()).to.equal(other.address);
    expect(await registry.owner()).to.equal(owner.address);
  });

  it("rejects ownership transfer initiation by unauthorized accounts", async function () {
    const { registry, other } = await deployFixture();

    await expect(registry.connect(other).transferOwnership(other.address))
      .to.be.revertedWith("Not contract owner");
  });

  it("allows only the pending owner to accept ownership", async function () {
    const { registry, owner, issuer, other } = await deployFixture();
    await registry.connect(owner).transferOwnership(issuer.address);

    await expect(registry.connect(other).acceptOwnership())
      .to.be.revertedWith("Not pending owner");
    await expect(registry.connect(issuer).acceptOwnership())
      .to.emit(registry, "OwnershipTransferred")
      .withArgs(owner.address, issuer.address);

    expect(await registry.owner()).to.equal(issuer.address);
    expect(await registry.pendingOwner()).to.equal(ethers.ZeroAddress);
  });

  it("gives new owner permissions and removes old owner permissions", async function () {
    const { registry, owner, issuer, other } = await deployFixture();
    await registry.connect(owner).transferOwnership(issuer.address);
    await registry.connect(issuer).acceptOwnership();

    await expect(registry.connect(issuer).authorizeIssuer(other.address, "INST-B"))
      .to.emit(registry, "IssuerAuthorized");
    await expect(registry.connect(owner).authorizeIssuer(other.address, "INST-C"))
      .to.be.revertedWith("Not contract owner");
  });

  it("binds student recipient address and enables student lookup", async function () {
    const { registry, owner, other: student } = await deployFixture();
    await registry.connect(owner).issueCertificateTo("CERT-STUDENT-01", certificateHash(), "OWNER", student.address);

    const result = await registry.verifyCertificate("CERT-STUDENT-01", certificateHash());
    expect(result[0]).to.equal(true);
    expect(result[5]).to.equal(student.address); // recipient

    const studentCerts = await registry.getStudentCertificates(student.address);
    expect(studentCerts.length).to.equal(1);
    expect(studentCerts[0]).to.equal("CERT-STUDENT-01");
  });

  it("anchors decentralized IPFS CID on-chain with zero tampering risk", async function () {
    const { registry, owner, other: student } = await deployFixture();
    const testCid = "QmZ4tDuvesekSs4qM5ZBKpXiZGun7S2CYtEZRB3DYXkjGx";
    await registry.connect(owner).issueCertificateWithIpfs(
      "CERT-IPFS-01",
      certificateHash(),
      "OWNER",
      student.address,
      testCid
    );

    const result = await registry.verifyCertificate("CERT-IPFS-01", certificateHash());
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(owner.address);
    expect(result[5]).to.equal(student.address);
    expect(result[6]).to.equal(testCid);
  });

  it("requires institute verification approval before employer access is granted", async function () {
    const { registry, owner, other: student } = await deployFixture();
    const [, , , employer] = await ethers.getSigners();
    await registry.connect(owner).issueCertificateTo("CERT-EMPLOYER-01", certificateHash(), "OWNER", student.address);

    // Initial check: not yet approved
    expect(await registry.isVerificationApproved("CERT-EMPLOYER-01", employer.address)).to.equal(false);

    // Unauthorized party cannot approve
    await expect(
      registry.connect(employer).approveVerification("CERT-EMPLOYER-01", employer.address)
    ).to.be.revertedWith("Not an authorized issuer");

    // Institute approves
    await expect(registry.connect(owner).approveVerification("CERT-EMPLOYER-01", employer.address))
      .to.emit(registry, "VerificationApproved")
      .withArgs("CERT-EMPLOYER-01", owner.address, employer.address);

    // Now approved!
    expect(await registry.isVerificationApproved("CERT-EMPLOYER-01", employer.address)).to.equal(true);
  });
});
