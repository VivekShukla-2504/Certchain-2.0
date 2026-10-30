const { expect } = require("chai");
const anyValue = require("@nomicfoundation/hardhat-chai-matchers/withArgs").anyValue;

describe("CertificateRegistry (OpenZeppelin AccessControl)", function () {
  async function deployFixture() {
    const [admin, institute, student, employer, unauthorized] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    return { registry, admin, institute, student, employer, unauthorized };
  }

  const sampleHash = () => ethers.keccak256(ethers.toUtf8Bytes("official-pdf-commitment-data"));

  describe("1. Institute Management (AccessControl)", function () {
    it("allows admin to register an authorized institute", async function () {
      const { registry, admin, institute } = await deployFixture();

      await expect(registry.connect(admin).registerInstitute(institute.address, "INST-IIT"))
        .to.emit(registry, "InstituteRegistered")
        .withArgs(institute.address, "INST-IIT");

      expect(await registry.isAuthorizedInstitute(institute.address)).to.equal(true);
    });

    it("rejects institute registration by unauthorized accounts", async function () {
      const { registry, unauthorized, institute } = await deployFixture();

      await expect(
        registry.connect(unauthorized).registerInstitute(institute.address, "INST-IIT")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("allows admin to revoke an institute", async function () {
      const { registry, admin, institute } = await deployFixture();
      await registry.connect(admin).registerInstitute(institute.address, "INST-IIT");

      await expect(registry.connect(admin).revokeInstitute(institute.address))
        .to.emit(registry, "InstituteRevoked")
        .withArgs(institute.address);

      expect(await registry.isAuthorizedInstitute(institute.address)).to.equal(false);
    });
  });

  describe("2. Credential Issuance & Verification", function () {
    it("allows registered institute to issue credential", async function () {
      const { registry, admin, institute, student } = await deployFixture();
      await registry.connect(admin).registerInstitute(institute.address, "INST-JNU");

      const certHash = sampleHash();
      const ipfsCid = "QmTestPinataCidHash2026";

      await expect(
        registry.connect(institute).issueCredential("CERT-SEP-001", certHash, student.address, ipfsCid)
      )
        .to.emit(registry, "CredentialIssued")
        .withArgs("CERT-SEP-001", certHash, student.address, institute.address, anyValue);

      // Verify on-chain
      const [isValid, issuer, instId, issuedAt, revoked, recipient, cid] =
        await registry.verifyCredential("CERT-SEP-001", certHash);

      expect(isValid).to.equal(true);
      expect(issuer).to.equal(institute.address);
      expect(instId).to.equal("INST-JNU");
      expect(recipient).to.equal(student.address);
      expect(cid).to.equal(ipfsCid);
      expect(revoked).to.equal(false);
    });

    it("rejects unauthorized issuance by non-institutes", async function () {
      const { registry, unauthorized, student } = await deployFixture();

      await expect(
        registry.connect(unauthorized).issueCredential("CERT-FAKE-01", sampleHash(), student.address, "")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("rejects duplicate certificate IDs", async function () {
      const { registry, admin, student } = await deployFixture();

      await registry.connect(admin).issueCredential("CERT-DUP-01", sampleHash(), student.address, "");
      await expect(
        registry.connect(admin).issueCredential("CERT-DUP-01", sampleHash(), student.address, "")
      ).to.be.revertedWith("Certificate ID already exists");
    });

    it("fetches student certificates on-chain", async function () {
      const { registry, admin, student } = await deployFixture();
      await registry.connect(admin).issueCredential("CERT-STU-01", sampleHash(), student.address, "");
      await registry.connect(admin).issueCredential("CERT-STU-02", sampleHash(), student.address, "");

      const list = await registry.getStudentCertificates(student.address);
      expect(list.length).to.equal(2);
      expect(list[0]).to.equal("CERT-STU-01");
      expect(list[1]).to.equal("CERT-STU-02");
    });
  });

  describe("3. Credential Revocation", function () {
    it("allows issuing institute to revoke credential", async function () {
      const { registry, admin, institute, student } = await deployFixture();
      await registry.connect(admin).registerInstitute(institute.address, "INST-A");
      await registry.connect(institute).issueCredential("CERT-REV-01", sampleHash(), student.address, "");

      await expect(registry.connect(institute).revokeCredential("CERT-REV-01"))
        .to.emit(registry, "CredentialRevoked")
        .withArgs("CERT-REV-01", institute.address);

      const [isValid, , , , revoked] = await registry.verifyCredential("CERT-REV-01", sampleHash());
      expect(isValid).to.equal(false);
      expect(revoked).to.equal(true);
    });

    it("rejects revocation by unauthorized third party", async function () {
      const { registry, admin, student, unauthorized } = await deployFixture();
      await registry.connect(admin).issueCredential("CERT-REV-02", sampleHash(), student.address, "");

      await expect(
        registry.connect(unauthorized).revokeCredential("CERT-REV-02")
      ).to.be.revertedWith("Not authorized to revoke");
    });
  });

  describe("4. Employer Verification Approval Queue", function () {
    it("allows institute to authorize employer verification request", async function () {
      const { registry, admin, student, employer } = await deployFixture();
      await registry.connect(admin).issueCredential("CERT-EMP-01", sampleHash(), student.address, "");

      expect(await registry.isVerificationApproved("CERT-EMP-01", employer.address)).to.equal(false);

      await expect(registry.connect(admin).approveVerification("CERT-EMP-01", employer.address))
        .to.emit(registry, "VerificationApproved")
        .withArgs("CERT-EMP-01", admin.address, employer.address);

      expect(await registry.isVerificationApproved("CERT-EMP-01", employer.address)).to.equal(true);
    });
  });
});
