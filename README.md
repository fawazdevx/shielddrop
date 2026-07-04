# ShieldDrop

Confidential token distribution OS for the Zama Developer Program Mainnet Season 3 TokenOps Special Bounty and Builder Track.

ShieldDrop lets teams create private token distribution campaigns for airdrops, investor payouts, contributor rewards, grants, and token unlocks. Allocation amounts remain encrypted onchain with Zama FHEVM. Recipients connect a wallet, verify eligibility, claim privately, and decrypt only their own allocation through the Zama user-decryption flow.

## Project Layout

- `contracts/` - Foundry contracts for campaign creation, encrypted allocation bookkeeping, registry validation, and claim authorization.
- `frontend/` - Vite React app with campaign creation, recipient claim, private analytics, faucet/wrapper helpers, and demo mode.
- `shared/` - Sepolia addresses, wrapper registry metadata, and ABI fragments shared by the UI.
- `docs/` - submission strategy, judging checklist, pitch script, and integration notes.

## Quick Start

```bash
npm install
npm run dev
```

The app runs with demo data by default. The Zama and TokenOps integration points are isolated in:

- `frontend/src/lib/zama.ts`
- `frontend/src/lib/tokenops.ts`

`frontend/src/lib/tokenops.ts` imports the official TokenOps SDK package and subpaths:

- `@tokenops/sdk`
- `@tokenops/sdk/fhe-airdrop`
- `@tokenops/sdk/fhe-disperse`

Without live wallet/RPC/relayer clients, the adapter runs a deterministic demo runtime that still produces TokenOps-style encrypted claim packets for the UI. With viem public/wallet clients and a Zama encryptor, the same adapter can create a TokenOps confidential airdrop, encrypt allocations, and sign recipient claim authorizations.

To connect Sepolia:

```bash
cp frontend/.env.example frontend/.env.local
```

Then add an RPC URL, relayer proxy URL, deployed ShieldDrop factory address, and TokenOps SDK config if available.

The installed `@tokenops/sdk` flow does not require `VITE_TOKENOPS_API_URL` or `VITE_TOKENOPS_PROJECT_ID`.
It uses viem `publicClient` / `walletClient`, Sepolia RPC, and a Zama encryptor. Keep those TokenOps env
vars empty unless TokenOps gives you separate hosted API credentials.

For production verification in this workspace:

```bash
cd frontend
npm exec -- tsc --noEmit
npm exec -- vite build --configLoader runner
```

`--configLoader runner` avoids Vite writing temporary files into a symlinked `frontend/node_modules` path in this local environment.

## Contract Deploy

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

## Zama References Used

- Sepolia wrapper registry: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`
- Confidential wrapper registry docs: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/wrapper-registry
- Confidential wrapper docs: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper
- Zama SDK quick start: https://docs.zama.org/protocol/sdk/getting-started/quick-start
