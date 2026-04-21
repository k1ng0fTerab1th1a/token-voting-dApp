# Token Voting — Blockchain Commit-Reveal DApp

A full-stack decentralized voting application built with **Solidity**, **FastAPI**, and **React**. Voters distribute 100 points across candidates using a **commit-reveal scheme** to prevent vote manipulation. After the voting closes, a machine-learning analytics pipeline runs anomaly detection, clustering, and PCA on the revealed votes.

---

## Architecture

```
┌─────────────────────┐     ethers.js      ┌──────────────────────┐
│   React Frontend    │ ◄────────────────► │  Ganache (local)     │
│   (Vite, port 5173) │                    │  port 7545           │
│                     │  HTTP REST         ├──────────────────────┤
│                     │ ◄────────────────► │  FastAPI Backend     │
└─────────────────────┘                    │  (uvicorn, port 8000)│
                                           │  → web3.py → Ganache │
                                           └──────────────────────┘
```

**Stack:**
- **Smart Contract** — Solidity (`SmartContract/TokenVoting.sol`)
- **Backend** — Python, FastAPI, web3.py, scikit-learn, pandas
- **Frontend** — React, Vite, ethers.js v6, recharts
- **Local Blockchain** — Ganache (RPC `http://127.0.0.1:7545`)

---

## How It Works

### Voting Lifecycle

The contract progresses through four phases determined by timestamps set at deployment:

| Phase | Description |
|---|---|
| `PLANNED` | Voting not yet open. Owner whitelists voters. |
| `COMMIT` | Voters submit a `keccak256` hash of their votes + a secret salt. No one can see the actual votes yet. |
| `REVEAL` | Voters publish their actual votes + salt. The contract verifies the hash and records vote counts. |
| `CLOSED` | Voting ended. Final results are immutable. |

### Commit-Reveal Scheme

Each voter distributes exactly **100 points** across all candidates. During the COMMIT phase they submit:

```
hash = keccak256(abi.encodePacked(voteArray, salt))
```

During REVEAL the contract checks `keccak256(voteArray, salt) == storedHash`. A mismatch reverts the transaction, preventing vote manipulation.

### Analytics Pipeline (Backend)

After the REVEAL phase begins, `GET /analytics/{contract_address}` runs an ML pipeline on the revealed votes:

1. **Feature engineering** — vote vectors, Shannon entropy per voter, reaction time since reveal opened
2. **Anomaly detection** — `IsolationForest` (5% contamination); flags instant voters (<10s), all-in votes, noise voters, statistical outliers
3. **Clustering** — `KMeans` (up to 3 clusters) on vote vectors to identify voting blocs
4. **PCA** — 2D projection of vote vectors for scatter visualization

Results are cached in `backend/data_cache/` — permanently once `CLOSED`, for 10 seconds during `REVEAL`.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | For the frontend |
| [Python](https://www.python.org/) | 3.10+ | For the backend |
| [Ganache](https://trufflesuite.com/ganache/) | Latest | Local blockchain — **must use port 7545** |
| [MetaMask](https://metamask.io/) | Latest | Browser wallet for interacting with the contract |

---

## Setup & Running

### 1. Start Ganache

Launch Ganache and create a **new workspace**. Make sure the RPC server is set to:
- **Host:** `127.0.0.1`
- **Port:** `7545`
- **Network ID:** `1337`

### 2. Configure MetaMask

Add Ganache as a custom network in MetaMask:

| Field | Value |
|---|---|
| Network Name | Ganache |
| RPC URL | `http://127.0.0.1:7545` |
| Chain ID | `1337` |
| Currency Symbol | `ETH` |

Import one or more Ganache accounts into MetaMask using their private keys (shown in the Ganache UI under the Accounts tab).

### 3. Start the Backend

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### 4. Start the Frontend

```powershell
cd frontend/voting-app
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Usage Walkthrough

### Deploy a Contract (`/`)

1. Connect MetaMask (make sure it's on the Ganache network).
2. Enter comma-separated candidate names, e.g.: `Alice, Bob, Carol`
3. Set durations in minutes:
   - **Setup duration** — how long the PLANNED phase lasts before voting opens
   - **Commit duration** — how long voters have to commit their hashes
   - **Reveal duration** — how long voters have to reveal their actual votes
4. Click **Deploy**. Copy the contract address shown after deployment.
5. Enter voter addresses (one per line) in the whitelist field and click **Whitelist**.

> The deploying account is the contract owner. Only the owner can whitelist voters.

### Cast a Vote (`/vote`)

1. Paste the contract address.
2. During the **COMMIT phase**: distribute 100 points across candidates, then click **Commit Vote**. Your votes and salt are saved to `localStorage`.
3. During the **REVEAL phase**: click **Reveal Vote**. The app retrieves your saved votes from `localStorage` and submits them to the contract.

### View Results (`/results/:address`)

Paste the contract address to view the analytics dashboard, which includes:
- Candidate scores (bar chart)
- Voting bloc profiles (stacked bar chart per KMeans cluster)
- 2D scatter plot of voter positions (PCA)
- Anomaly table listing suspicious voters and detected reasons

Analytics are only available once the REVEAL phase has begun.

---

## Project Structure

```
lab3/
├── SmartContract/
│   └── TokenVoting.sol           # Solidity contract (commit-reveal voting)
│
├── backend/
│   ├── requirements.txt
│   ├── token_voting.json         # Contract ABI (loaded by web3.py)
│   ├── data_cache/               # Cached analytics results per address
│   └── app/
│       ├── main.py               # FastAPI app + caching logic
│       ├── config.py             # web3 connection (Ganache 7545) + ABI loader
│       ├── schemas.py            # Pydantic response models
│       └── services/
│           ├── blockchain.py     # on-chain reads: status, candidates, VoteRevealed events
│           └── analytics.py      # ML pipeline: IsolationForest, KMeans, PCA
│
└── frontend/voting-app/
    ├── vite.config.js
    └── src/
        ├── App.jsx               # Router (/, /vote, /results/:address)
        ├── contracts/
        │   └── TokenVoting.json  # ABI + bytecode (used by ethers.js for deployment)
        └── pages/
            ├── DeployPage.jsx    # Deploy contract + whitelist voters
            ├── VotePage.jsx      # Commit + reveal votes
            └── ResultsPage.jsx   # Analytics dashboard (fetches from backend)
```

---

## Configuration

All configuration is hardcoded. If you need to change anything:

| Setting | File | Default |
|---|---|---|
| Ganache RPC URL | `backend/app/config.py` | `http://127.0.0.1:7545` |
| Backend API URL (frontend) | `frontend/voting-app/src/pages/ResultsPage.jsx` | `http://127.0.0.1:8000` |
| Analytics cache TTL (REVEAL) | `backend/app/main.py` | 10 seconds |
| IsolationForest contamination | `backend/app/services/analytics.py` | 5% |
| Max KMeans clusters | `backend/app/services/analytics.py` | 3 |

---

## Smart Contract Details

**Constructor:** `TokenVoting(string[] names, uint256 startCommit, uint256 startReveal, uint256 close)`

All three timestamps are Unix epoch seconds. The frontend computes them as:
```
startCommit = now + setupDuration * 60
startReveal = startCommit + commitDuration * 60
close       = startReveal + revealDuration * 60
```

**Vote hash:** `keccak256(abi.encodePacked(uint256[] votes, string salt))`

The frontend uses ethers.js `solidityPackedKeccak256(["uint256[]", "string"], [votes, salt])` to produce a compatible hash.
