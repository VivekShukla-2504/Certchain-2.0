# CertChain — Setup Guide

Blockchain-Based Secure Academic Certificate Issuance and Verification System
JNU · Blockchain Technology · Nimmi Sahu, Vartika Yadav, Vivek Shukla

Real stack: React, Node.js/Express, MongoDB, Solidity smart contract (Hardhat), ethers.js and JWT auth. Certificate PDFs are stored locally by the backend; optional IPFS backups are encrypted before upload.

You need **4 terminals open at once**. Do these in order.

## Prerequisites (install once)
- Node.js 18+ and npm — https://nodejs.org
- MongoDB running locally, OR a free MongoDB Atlas connection string
- (Optional) IPFS Desktop / IPFS daemon — only needed if you want file storage on IPFS. Everything else works without it.

## 1. Install dependencies

```bash
# from the project root
npm install

cd backend
npm install

cd ../frontend
npm install
```

## 2. Terminal 1 — start a local blockchain

```bash
# from project root
npx hardhat node
```

This starts a local Ethereum test network and prints 20 test accounts with
private keys and 10,000 test ETH each. **Copy the first account's private
key** — you'll paste it into `backend/.env` in step 4. Leave this terminal running.

## 3. Terminal 2 — compile and deploy the smart contract

```bash
# from project root, in a new terminal
npx hardhat compile
npm run deploy:local
```

This prints something like:
```
CertificateRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa
```
**Copy this address** — you'll paste it into `backend/.env` in the next step.

## 4. Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in:
- `MONGO_URI` — your local MongoDB URI (default `mongodb://127.0.0.1:27017/certchain` works if MongoDB is running locally)
- `JWT_SECRET` — any random long string
- `RPC_URL` — leave as `http://127.0.0.1:8545` (the Hardhat node from step 2)
- `PRIVATE_KEY` — the private key you copied in step 2
- `CONTRACT_ADDRESS` — the address you copied in step 3

Optional governance settings:
- `INSTITUTION_APPROVAL_REQUIRED=true` makes new institution signups wait for platform approval. Existing accounts without a status remain approved.
- Set `PLATFORM_ADMIN_KEY` to a long random secret to enable the restricted `/platform-admin` page. Keep this key private; the page sends it only in admin API requests.
- Approval and role changes are checked against MongoDB on each protected request, so suspension takes effect for existing sessions too.

Optional IPFS:
- The backend encrypts each PDF with AES-256-GCM before pinning it. Create a fresh 32-byte key (64 hexadecimal characters) with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it only as `IPFS_ENCRYPTION_KEY` in the backend's secret environment. Back it up securely; losing it makes IPFS backups unrecoverable.
- For local Kubo, set `IPFS_PROVIDER=kubo`, run `ipfs daemon`, and set `IPFS_API_URL=http://127.0.0.1:5001`. For Pinata, set `IPFS_PROVIDER=pinata` and create an API JWT in the Pinata dashboard; store it as `IPFS_API_TOKEN`. Pinata's free plan currently includes 1 GB storage. Pinata uploads encrypted bytes to public IPFS, and downloads use `IPFS_GATEWAY_URL` (default `https://gateway.pinata.cloud/ipfs`).
- Set `IPFS_ENABLED=true` only after the provider credentials and encryption key are configured. `IPFS_ORIGIN` is used for Kubo CORS where applicable. Restart/redeploy the backend after changing environment variables.
- Each new IPFS CID identifies encrypted content, not a directly viewable PDF. Authorized source-PDF downloads use the backend; if its local file is missing, it retrieves the ciphertext from IPFS, decrypts it server-side, and checks the original SHA-256 before returning the file.
- Do not create public gateway links for student files. Any PDFs pinned before encryption was added may be plaintext; treat those CIDs as exposed and do not reuse/share them.

### Staging signer model

For this free-tier staging setup, `PRIVATE_KEY` is held only by the backend
environment and is used by the platform wallet to sign blockchain transactions.
The institution wallet address collected during registration is identity
metadata only. Institutions do not provide private keys, and the application
does not claim that an institution wallet signed the transaction. The recorded
on-chain issuer is the platform signer address.

## 5. Terminal 3 — start the backend

```bash
cd backend
npm run dev
```

You should see `MongoDB connected` and `Server running on http://localhost:5000`.
Test it: open `http://localhost:5000/api/health` in a browser — should show `{"status":"ok"}`.

## 6. Terminal 4 — start the frontend

```bash
cd frontend
npm start
```

Opens `http://localhost:3000` in your browser automatically.

## 7. Demo flow for your viva

1. Go to **Institution login** → **Register your institution**. For "wallet address", paste any of the test account addresses printed by `npx hardhat node` in Terminal 1.
2. Log in.
3. Go to **Issue certificate**, choose a document type, fill in the student fields, then either upload an existing PDF (maximum 10 MB) or choose **Generate official PDF**. The generated template includes the institution, student details, certificate ID and verification QR. Its PDF hash and metadata are committed to the local blockchain after you issue it. If IPFS is enabled, an encrypted copy is pinned and its CID is displayed.
4. A generated PDF preview is signed by a 10-minute, institution-bound preparation token. Editing its details invalidates the preview; generate it again before issuance.
5. Open **Students** to see a student's documents grouped by normalized roll number, or **Certificates** to browse individual records.
6. Go to public **Verify certificate**, enter the ID, upload the exact PDF, and enter the fields printed on it. A changed PDF or changed field should fail verification.
7. Open **Privacy settings** to choose which verified details are displayed publicly. The default hides grade and roll number. **Audit history** supports action/date filters and CSV export.
8. For tamper detection, make a copy of the issued PDF, change its contents, and verify the copy using the same ID and metadata. Keep the original for a successful verification demo.

### Institution approval and roles

Set `INSTITUTION_APPROVAL_REQUIRED=true` and configure a private `PLATFORM_ADMIN_KEY` in `backend/.env`, then restart the backend. New signups remain pending until an operator opens `http://localhost:3000/platform-admin` and approves them. The platform key endpoint is rate-limited. The existing data model has one login account per institution; its role can be set to `admin`, `issuer`, or `reviewer` (reviewers are read-only). Separate staff invitations are not part of this version.

### Local PDF storage and privacy

PDFs are stored under `backend/uploads/certificates/`, outside MongoDB and ignored by Git. Back up this directory along with the database if you need to preserve issued source PDFs. The institution-only download endpoint is protected by JWT. Public verification checks the submitted PDF and metadata against the on-chain hash; disclosure settings only control which verified fields are displayed. Optional IPFS copies are AES-256-GCM encrypted before upload, but the backend's encryption key must be backed up separately and protected.

Institution admins can download a ZIP backup from **Privacy settings**. It contains certificate metadata, available PDFs, and audit entries. Restore validates the institution ID and on-chain hashes, skips conflicts, and requires the original blockchain records to still be available. Keep the ZIP private because it contains student data.

The ZIP backup/export is limited to 1,000 certificates and 100 MB of PDF data. The current institution model has one login per institution; `admin`, `issuer` and `reviewer` control that account's permissions. Additional staff invitations require a separate user-account model.

### Tests

```bash
# from project root
npx hardhat test

# from backend
npm test
```

The frontend also supports a saved light/dark theme toggle in the public and institution headers.

## Project structure

```
certchain-full/
├── contracts/CertificateRegistry.sol   # on-chain hash registry
├── scripts/deploy.js                   # deployment script
├── hardhat.config.js
├── backend/
│   ├── server.js                       # Express entry point
│   ├── models/                         # MongoDB schemas
│   ├── routes/                         # auth, certificates, verify, audit, institution/platform admin
│   ├── middleware/auth.js              # JWT check
│   └── utils/                          # hashing, PDF generation/upload, backup, audit, IPFS
└── frontend/
    └── src/
        ├── App.js                      # routes
        └── pages/                      # institution workspace, bulk issue, public verify, settings, audit
```

## If something goes wrong tonight

- **MongoDB connection error** → make sure `mongod` is running, or use a free MongoDB Atlas cluster and paste its connection string into `MONGO_URI`.
- **"insufficient funds" or contract errors** → make sure `npx hardhat node` (Terminal 1) is still running and you copied its private key/address correctly.
- **CORS errors in browser console** → make sure backend is running on port 5000 and frontend's `REACT_APP_API_URL` (in `frontend/.env` if you create one) points to `http://localhost:5000/api`.
- **Out of time to get the real blockchain running** → the `CertChain-Demo.html` file from earlier in this chat works standalone with zero setup and demonstrates the exact same hash-verification logic — good as a backup demo.
