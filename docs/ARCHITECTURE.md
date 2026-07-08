# ShieldDrop Architecture

## Executive Summary

ShieldDrop is a confidential distribution desk for teams that need to send ERC-7984 confidential tokens without publishing the payout table.

The product targets the Zama Developer Program Season 3 TokenOps Special Bounty. It shows a complete workflow: a creator selects an official Sepolia confidential wrapper, imports recipients, validates the batch, stages a TokenOps confidential airdrop or confidential disperse, generates recipient claim packets, and gives each recipient a Claim Desk where they decrypt only their own allocation.

Judges should look at ShieldDrop as more than a polished UI. The repository contains:

- a TokenOps SDK adapter that imports the official confidential airdrop and confidential disperse modules;
- a Zama/FHE boundary for encrypted allocation, wrapper discovery, and user decryption UX;
- Foundry contracts that store allocations as `euint64` values and transfer ERC-7984 confidential tokens;
- a registry-first token picker wired to the official Zama Sepolia wrapper registry;
- a public-safe audit surface that proves distribution progress without exporting plaintext allocations.

The core privacy promise is narrow and concrete: allocation amounts stay encrypted, recipients decrypt only their own amount, and public observers can track operational status without reading the private payout table.

## Bounty Fit

| Requirement | ShieldDrop implementation |
| --- | --- |
| Confidential airdrop | Creator stages claim-based drops through the TokenOps confidential airdrop path. |
| Confidential disperse | Creator can switch to the confidential disperse route for private batch payouts. |
| TokenOps SDK usage | `frontend/src/lib/tokenops.ts` imports `@tokenops/sdk`, `@tokenops/sdk/fhe-airdrop`, and `@tokenops/sdk/fhe-disperse`. |
| Zama confidential tokens | The UI selects official Sepolia ERC-7984 wrappers and the contracts work with encrypted `euint64` allocations. |
| Recipient decryption | Claim Desk gates the recipient flow and models Zama user decryption before claim. |
| Real product UX | Command Center, CSV validation, claim packets, Claim Desk, Registry, Audit Desk, and demo/live runtime labels. |
| Builder-track depth | Foundry contracts, proxy deployment path, tests, frontend, architecture docs, and submission assets. |

## System Map

```text
Creator wallet
  |
  | connects through the React app
  v
Command Center
  |
  | CSV validation, wrapper selection, route selection
  v
TokenOps SDK Adapter
  |
  | confidential airdrop or confidential disperse
  | encryption, funding, signatures, claim packets
  v
TokenOps / Zama / Sepolia
  |
  | encrypted allocation handles and confidential token transfers
  v
Recipient Claim Desk
  |
  | wallet verification, user decryption, confidential claim
  v
Public-safe Audit Desk
```

ShieldDrop keeps protocol calls behind explicit adapter boundaries. That makes the UI usable in deterministic demo mode for judges while preserving a live Sepolia path for wallet clients, public clients, and a Zama encryptor.

## Frontend Architecture

The frontend is a Vite React app in `frontend/`.

Main surfaces:

- `frontend/src/views/CommandCenter.tsx` handles creator workflow, CSV validation, distribution route selection, TokenOps preflight, encryption, and private staging.
- `frontend/src/views/ClaimDesk.tsx` handles recipient verification, allocation reveal, and confidential claim actions.
- `frontend/src/views/RegistryDesk.tsx` shows official wrapper pairs so creators understand which assets the app supports.
- `frontend/src/views/AuditDesk.tsx` exposes public-safe evidence: route, network, token, claim packets, encrypted batch ID, launch checklist, and export action.
- `frontend/src/lib/tokenops.ts` isolates the TokenOps SDK integration.
- `frontend/src/lib/zama.ts` isolates Zama-style wrapper discovery, allocation encryption, and user-decryption behavior for the app layer.

The app uses local deterministic data when live clients are absent. It labels that runtime instead of hiding it. When live clients are supplied, the same TokenOps adapter can stage real Sepolia distributions.

## TokenOps SDK Boundary

`frontend/src/lib/tokenops.ts` is the main bounty evidence file.

It imports:

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

The adapter resolves live Sepolia routes from the SDK registry:

- confidential airdrop factory via `getFheAirdropFactoryAddress(11155111)`;
- confidential disperse singleton via `getFheDisperseSingletonAddress(11155111)`.

### Live Confidential Airdrop

In live airdrop mode, ShieldDrop:

1. requires `publicClient`, `walletClient`, and a Zama-compatible `encryptor`;
2. checks or sets the TokenOps factory as an ERC-7984 operator;
3. encrypts the funding total with `encryptUint64`;
4. calls `createAndFundConfidentialAirdrop`;
5. encrypts each recipient allocation for the created airdrop address;
6. signs recipient claim authorization data with `signClaimAuthorization`;
7. returns recipient-specific claim packets containing encrypted input, signature, airdrop address, and delivery URL.

This is the product flow judges should inspect. ShieldDrop builds the creator workflow around TokenOps primitives instead of treating the SDK as a logo on the submission page.

### Live Confidential Disperse

In live disperse mode, ShieldDrop:

1. creates a confidential disperse client;
2. passes validated recipients and amounts into `disperse.disperse`;
3. records the returned transaction hash;
4. keeps the same campaign and audit surfaces so teams can compare airdrop and batch payout workflows.

The Claim Desk still uses claim packets for a consistent demo and delivery model. The disperse path proves the app can support both TokenOps bounty routes from the same creator workflow.

### Demo Runtime

Without wallet, RPC, or relayer credentials, the adapter generates deterministic TokenOps-style claim packets. Demo mode exists so judges can click the full product without secrets, funded wallets, or a live relayer.

The runtime is explicit:

- `runtime: "demo"` means deterministic handles, deterministic signatures, and simulated transaction IDs;
- `runtime: "live"` means viem clients, wallet account, Zama encryptor, TokenOps SDK calls, and Sepolia transaction output.

This split keeps the demo honest. It also lets the frontend, claim delivery, audit export, and user-decryption UX be judged without blocking on infrastructure.

## Zama And ERC-7984 Boundary

ShieldDrop models confidential tokens as the default asset type, not an afterthought.

The app uses the official Zama Sepolia wrapper registry address:

```text
0x2f0750Bbb0A246059d80e94c454586a7F27a128e
```

Creator workflow starts with wrapper selection. That matters because teams should distribute supported confidential assets, not ad hoc demo tokens.

The Zama adapter boundary covers:

- wrapper pair discovery;
- recipient allocation encryption UX;
- confidential balance and allocation reveal UX;
- EIP-712-style user decryption;
- claim simulation for demo mode.

The current `DemoZamaClientAdapter` mirrors the app-level flow while the live TokenOps adapter handles the real encryption path when live clients exist.

## Smart Contract Architecture

The contracts live in `contracts/src/`.

### `ShieldDropFactory`

`ShieldDropFactory` creates campaign contracts and validates every selected token against the wrapper registry before deployment.

The key guard is:

```solidity
if (!registry.isConfidentialTokenValid(token)) revert InvalidConfidentialToken();
```

That single check raises the quality bar. It prevents a creator from launching a campaign against a random token that does not belong to the official confidential wrapper set.

The factory also includes a minimal upgrade path:

- ERC-1967 implementation slot;
- `proxiableUUID`;
- owner-gated `upgradeTo`;
- owner-gated `upgradeToAndCall`;
- validation that the new implementation supports the same slot.

Judges can inspect proxy deployment support in `contracts/script/Deploy.s.sol`.

### `ShieldDropCampaign`

Each campaign stores recipient allocations as `euint64`, which matches Zama confidential wrappers' 6-decimal `uint64` balance model.

Campaign flow:

1. The creator or TokenOps operator submits an `externalEuint64` allocation plus input proof.
2. The campaign imports the encrypted value with `FHE.fromExternal(encryptedAmount, inputProof)`.
3. The campaign grants persistent access to the recipient with `FHE.allow(allocation, recipient)`.
4. The campaign grants itself access with `FHE.allowThis(allocation)`.
5. The recipient calls `claim()` during the claim window.
6. The campaign grants the ERC-7984 token transient access with `FHE.allowTransient(allocation, token)`.
7. The token sends the encrypted amount through `confidentialTransfer(recipient, allocation)`.

The contract enforces:

- creator or TokenOps-operator registration only;
- nonzero recipient addresses;
- batch length checks;
- claim start and end bounds;
- pause control;
- double-claim prevention;
- explicit public counters for recipient count and claimed count.

The contract does not need plaintext amounts at claim time. It only needs an encrypted handle with the correct ACL.

## End-To-End Workflows

### Creator: Private Airdrop

1. Creator connects a Sepolia wallet.
2. Creator selects `Airdrop`.
3. Creator selects an official confidential wrapper such as `cUSDTMock`.
4. Creator imports a CSV with wallet, label, and amount.
5. ShieldDrop validates addresses, duplicates, positive amounts, totals, route readiness, and start-window safety.
6. Creator can click `Preview demo packets` if they are offline or not ready for Sepolia.
7. When the runtime badge says `Live · Sepolia`, creator clicks `Stage live on Sepolia`.
8. TokenOps adapter opens wallet prompts, stages the confidential airdrop, and returns claim packets.
9. ShieldDrop records the setup transaction, stage transaction, claim-packet count, and Etherscan links.
10. Creator copies recipient-specific claim links.

### Creator: Confidential Disperse

1. Creator switches the route to `Disperse`.
2. The same validated recipient batch feeds the confidential disperse client.
3. ShieldDrop records route evidence, encrypted batch ID, transaction hash in live mode, and public-safe audit metadata.

### Recipient: Claim Desk

1. Recipient opens a claim link.
2. Claim Desk reads encrypted packet data from the URL.
3. Recipient connects a wallet.
4. ShieldDrop matches the connected wallet to the claim packet.
5. Recipient signs a user-decryption request.
6. The UI reveals only that recipient's amount.
7. Recipient claims confidentially.

### Team: Audit Desk

The Audit Desk gives teams evidence they can share:

- selected route;
- network;
- wrapper token;
- recipient count;
- claim packet count;
- encrypted batch ID;
- launch checklist;
- public-safe export.

The export avoids plaintext amounts and private allocation tables.

## Privacy And Trust Model

ShieldDrop makes the privacy boundary visible because judges should not have to infer it.

### Private

- Allocation amounts are encrypted as `euint64`.
- Recipients decrypt only allocations for which they have ACL access.
- Claim packet payloads carry encrypted handles and proofs, not plaintext amounts.
- Audit export avoids plaintext allocation amounts.

### Public

- The selected confidential token can be public.
- Campaign addresses, factory addresses, and TokenOps route addresses can be public.
- Claim status and aggregate progress can be public.
- Recipient addresses can become public through onchain campaign registration or claim events, depending on the route used.

### Trusted Components

- The connected creator wallet approves staging and funding.
- TokenOps SDK constructs the confidential airdrop or disperse route.
- Zama FHEVM enforces encrypted computation, ACL, and user decryption.
- The frontend owns CSV handling, delivery UX, runtime labeling, and audit export.

This model avoids overclaiming. ShieldDrop protects allocation values first, then gives teams a path to keep distribution operations cleaner than a public spreadsheet or plaintext Merkle file.

## Verification

Contract tests cover campaign creation, registry validation, recipient registration, encrypted claim flow, pause controls, invalid claim windows, double claims, and upgrade authorization.

Run:

```bash
npm run contracts:test
```

Frontend production build:

```bash
npm run build
```

Local frontend type/build commands:

```bash
cd frontend
npm exec -- tsc --noEmit
npm exec -- vite build --configLoader runner
```

## Production Deployment Checklist

Before a final live demo, complete these steps:

1. Deploy `ShieldDropFactory` or `ShieldDropFactoryProxy` to Sepolia with the official wrapper registry.
2. Set `VITE_SHIELDDROP_FACTORY_ADDRESS`.
3. Set `VITE_SEPOLIA_RPC_URL`.
4. Proxy the Zama relayer behind `/api/relayer/11155111` so API keys stay server-side.
5. Supply viem public and wallet clients plus a Zama encryptor to `TokenOpsSdkAdapter`.
6. Run a live `cUSDTMock` airdrop with three Sepolia recipients.
7. Record the generated claim packets, recipient decryption, and final claim.
8. Export the Audit Desk metadata.
9. Include the contract address, transaction hash, and passing test output in the submission.

## Judge-Facing Differentiators

- ShieldDrop uses the official TokenOps SDK package and bounty-specific subpaths.
- It supports both confidential airdrop and confidential disperse from one workflow.
- It treats the official Zama wrapper registry as the source of truth for supported assets.
- It gives recipients a focused Claim Desk instead of burying decryption inside creator tooling.
- It shows what remains public and what stays encrypted.
- It includes contracts, tests, frontend, registry browser, audit export, demo runtime, and live-runtime boundaries.
- It feels like a product a team could use for contributor rewards, investor distributions, grants, unlocks, and community airdrops.

The strongest part of the architecture is the handoff between product UX and protocol primitives: creators manage a distribution like a SaaS workflow, while TokenOps, ERC-7984 confidential tokens, and Zama FHEVM handle the encrypted distribution path.
