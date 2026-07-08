# ShieldDrop

Confidential token distribution for private airdrops, contributor rewards, grants, investor payouts, team distributions, and unlocks.

ShieldDrop targets the Zama Developer Program Season 3 TokenOps Special Bounty and Builder Track. The app gives a team a complete distribution desk: select an official ERC-7984 confidential token, import a recipient CSV, validate the batch, stage a TokenOps confidential airdrop or confidential disperse, generate encrypted claim packets, and let recipients decrypt only their own allocation before claiming.

Demo site: `https://shielddrop.vercel.app`

## Why This Exists

Token distributions leak sensitive data. Airdrops expose recipient lists, contributor rewards expose compensation, investor distributions expose allocation sizes, and unlocks create public payout tables.

ShieldDrop keeps the amount private. Teams still get operational proof: route, token, packet count, claim progress, and audit metadata. Recipients get a Claim Desk where they verify eligibility, run user decryption, and claim without publishing their allocation.

## What Judges Should Inspect First

| Area | File or screen | Why it matters |
| --- | --- | --- |
| TokenOps SDK integration | `frontend/src/lib/tokenops.ts` | Imports `@tokenops/sdk`, `@tokenops/sdk/fhe-airdrop`, and `@tokenops/sdk/fhe-disperse`; resolves Sepolia factory/singleton addresses; builds live and demo distribution results. |
| Creator workflow | `frontend/src/views/CommandCenter.tsx` | Shows route selection, CSV validation, registry token selection, preflight checks, encryption, and private staging. |
| Recipient workflow | `frontend/src/views/ClaimDesk.tsx` | Shows wallet gating, recipient-only allocation reveal, user-decryption UX, claim state, and public-safe progress. |
| Registry usage | `shared/sepolia.ts` and `frontend/src/views/RegistryDesk.tsx` | Uses the official Zama Sepolia wrapper registry and known ERC-7984 wrapper pairs. |
| Contracts | `contracts/src/ShieldDropFactory.sol` and `contracts/src/ShieldDropCampaign.sol` | Validates confidential tokens, stores allocations as `euint64`, grants FHE ACL access, and transfers ERC-7984 confidential tokens on claim. |
| Audit surface | `frontend/src/views/AuditDesk.tsx` | Exports public-safe evidence without plaintext allocation amounts. |
| Architecture brief | `docs/ARCHITECTURE.md` | Explains the protocol boundary, privacy model, live/demo split, and bounty fit. |

## Bounty Fit

| Requirement | ShieldDrop support |
| --- | --- |
| Confidential airdrop | `TokenOpsSdkAdapter` can stage claim-based confidential airdrops through the TokenOps factory route. |
| Confidential disperse | The same creator workflow supports TokenOps confidential disperse for private batch payouts. |
| Zama FHEVM | Contracts use encrypted `euint64` allocations and FHE ACL grants. |
| ERC-7984 confidential tokens | Campaigns transfer confidential token amounts through `confidentialTransfer`. |
| Official wrapper registry | Factory validates selected confidential tokens against the Sepolia wrapper registry. |
| Recipient decryption | Claim Desk models recipient-only user decryption before claim. |
| Product polish | Creator dashboard, claim page, registry browser, claim packet preview, audit export, demo mode, and live runtime path. |

## Core Workflow

```text
Creator
  -> Connect Sepolia wallet
  -> Select Airdrop or Disperse
  -> Pick official confidential wrapper, for example cUSDTMock
  -> Import recipient CSV
  -> Validate addresses, duplicates, totals, route readiness, claim window
  -> Preview demo packets or stage live on Sepolia through TokenOps
  -> Copy encrypted recipient claim links

Recipient
  -> Open claim link
  -> Connect wallet
  -> Match wallet to claim packet
  -> Sign user-decryption request
  -> Reveal only their allocation
  -> Claim confidentially

Team / Judge
  -> Open Registry view
  -> Open Audit view
  -> Verify Sepolia transaction proof links
  -> Export public-safe metadata
```

## TokenOps Integration

`frontend/src/lib/tokenops.ts` is the integration boundary.

It imports the official package and bounty routes:

```ts
import {
  getFheAirdropFactoryAddress,
  getFheDisperseSingletonAddress
} from "@tokenops/sdk";

import {
  createConfidentialAirdropClient,
  createConfidentialAirdropFactoryClient,
  encryptUint64,
  erc7984OperatorAbi,
  signClaimAuthorization
} from "@tokenops/sdk/fhe-airdrop";

import {
  createConfidentialDisperseClient
} from "@tokenops/sdk/fhe-disperse";
```

Live airdrop mode:

1. Requires viem `publicClient`, `walletClient`, and a Zama-compatible `encryptor`.
2. Checks or sets the TokenOps factory as an ERC-7984 operator.
3. Encrypts the funding amount with `encryptUint64`.
4. Calls `createAndFundConfidentialAirdrop`.
5. Encrypts each recipient allocation for the created airdrop address.
6. Signs recipient claim authorization data with `signClaimAuthorization`.
7. Returns claim packets with encrypted input, signature, airdrop address, delivery URL, and Sepolia transaction proof.

Live disperse mode:

1. Creates a TokenOps confidential disperse client.
2. Passes validated recipient addresses and amounts into `disperse.disperse`.
3. Records the transaction hash and route evidence for the Audit Desk.

Demo mode:

When wallet, RPC, or relayer clients are missing, the adapter returns deterministic TokenOps-style claim packets. Judges can still click the full product flow without secrets or funded wallets. The UI labels runtime as `demo` or `live`, separates `Preview demo packets` from `Stage live on Sepolia`, and only shows Etherscan proof after a live transaction.

## Zama And ERC-7984 Details

ShieldDrop uses the official Zama Sepolia wrapper registry:

```text
0x2f0750Bbb0A246059d80e94c454586a7F27a128e
```

Configured wrapper examples in `shared/sepolia.ts`:

- `cUSDCMock`
- `cUSDTMock`
- `cWETHMock`
- `cBRONMock`
- `cZAMAMock`
- `ctGBPMock`
- `cXAUtMock`
- `ctGBP`

Contract flow:

1. `ShieldDropFactory` rejects unsupported confidential tokens with `InvalidConfidentialToken`.
2. `ShieldDropCampaign` imports encrypted allocations with `FHE.fromExternal`.
3. The campaign grants access to the recipient and itself with `FHE.allow` and `FHE.allowThis`.
4. During claim, the campaign gives the ERC-7984 token transient access with `FHE.allowTransient`.
5. The token sends the encrypted value with `confidentialTransfer`.

## Privacy Model

Private:

- Allocation amounts are encrypted as `euint64`.
- Recipients decrypt only allocations for which they have access.
- Claim packets carry encrypted handles and proofs, not plaintext amounts.
- Audit export avoids plaintext allocation amounts.

Public:

- Token choice, campaign address, TokenOps route address, claim status, and aggregate progress can be public.
- Recipient addresses can become public through campaign registration or claim events, depending on the route.

This README does not claim full recipient-address anonymity. ShieldDrop focuses on the high-value leak: private allocation amounts.

## Project Layout

```text
contracts/
  src/
    ShieldDropFactory.sol
    ShieldDropCampaign.sol
    ShieldDropFactoryProxy.sol
  test/
    ShieldDropFactory.t.sol
    ShieldDropCampaign.t.sol
  script/
    Deploy.s.sol

frontend/
  src/
    App.tsx
    lib/tokenops.ts
    lib/zama.ts
    views/CommandCenter.tsx
    views/ClaimDesk.tsx
    views/RegistryDesk.tsx
    views/AuditDesk.tsx

shared/
  sepolia.ts
  abis.ts

docs/
  ARCHITECTURE.md
  JUDGING.md
  VIDEO_SCRIPT_REAL_PERSON.md
  SUBMISSION_PACKET.md
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Open the Vite URL printed in the terminal. The app runs with deterministic demo data by default.

## Sepolia Configuration

Copy the frontend env template:

```bash
cp frontend/.env.example frontend/.env.local
```

Fill the values you have:

```bash
VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
VITE_ZAMA_RELAYER_URL=https://relayer.testnet.zama.org/v2
VITE_SHIELDDROP_FACTORY_ADDRESS=
VITE_WALLETCONNECT_PROJECT_ID=
```

The installed `@tokenops/sdk` path does not require `VITE_TOKENOPS_API_URL` or `VITE_TOKENOPS_PROJECT_ID`. Leave those empty unless TokenOps gives separate hosted API credentials.

## Build And Test

Frontend production build:

```bash
npm run build
```

Frontend type/build commands from `frontend/`:

```bash
cd frontend
npm exec -- tsc --noEmit
npm exec -- vite build --configLoader runner
```

Contracts:

```bash
npm run contracts:build
npm run contracts:test
```

## Deploy Contracts

Proxy deployment path:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployShieldDropProxy \
  --rpc-url $SEPOLIA_RPC_URL \
  --chain-id $SEPOLIA_CHAIN_ID \
  --account deploytestKey \
  --sender $OWNER_ADDRESS \
  --broadcast \
  -vvv
```

Then set:

```bash
VITE_SHIELDDROP_FACTORY_ADDRESS=<deployed proxy or factory>
```

## Demo Checklist

For the strongest judging recording:

1. Open ShieldDrop and connect a Sepolia wallet.
2. Select `Airdrop`, then select `cUSDTMock` from the registry.
3. Import a CSV with three recipients.
4. Run validation.
5. If you are not live yet, click `Preview demo packets` to show the packet UX.
6. When the runtime badge says `Live · Sepolia`, click `Stage live on Sepolia`.
7. Show the wallet prompt and the `View Sepolia tx` link.
8. Copy a generated claim link.
9. Open the Claim Desk in a new tab.
10. Connect the recipient wallet.
11. Decrypt the allocation.
12. Claim on Sepolia.
13. Show the claim transaction link in Claim Desk or Audit.
14. Show Registry and Audit views.
15. Export the public-safe audit CSV with stage and claim tx hashes.
16. Show passing `npm run contracts:test` output if time allows.

If you record in demo mode, say that it is the deterministic demo runtime. If you record live Sepolia transactions, show the transaction hash.

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- Judging checklist: `docs/JUDGING.md`
- Real-person video script: `docs/VIDEO_SCRIPT_REAL_PERSON.md`
- Submission packet: `docs/SUBMISSION_PACKET.md`

## References

- Zama Sepolia wrapper registry: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`
- Confidential wrapper registry docs: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/wrapper-registry
- Confidential wrapper docs: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper
- Zama SDK quick start: https://docs.zama.org/protocol/sdk/getting-started/quick-start
