# ShieldDrop Architecture

## Product Goal

ShieldDrop is a confidential distribution OS for private airdrops, grants, investor payouts, contributor rewards, and unlocks. It combines:

- TokenOps-style campaign creation and CSV allocation workflows.
- Zama FHEVM encrypted allocation storage.
- ERC-7984 confidential token transfer/claim flows.
- The official Zama wrappers registry on Sepolia.
- Recipient-side EIP-712 user decryption.

## Contract Model

### `ShieldDropFactory`

Creates campaign contracts and validates every selected confidential token against the official wrappers registry before deployment.

Registry validation uses:

```solidity
registry.isConfidentialTokenValid(token)
```

This avoids fragmented test wrappers and matches the bounty goal of productizing official registry assets.

### `ShieldDropCampaign`

Each campaign stores recipient allocations as `euint64`, matching Zama confidential wrappers' 6-decimal `uint64` balance model.

Core flow:

1. Creator or TokenOps operator encrypts recipient amounts with the campaign contract as target.
2. Campaign imports each amount with `FHE.fromExternal(encryptedAmount, inputProof)`.
3. Campaign grants persistent ACL access to:
   - the campaign contract, so it can transfer at claim time;
   - the recipient, so they can decrypt their own allocation with EIP-712 user decryption.
4. Recipient calls `claim()`.
5. Campaign gives the ERC-7984 token transient access to the allocation and calls `confidentialTransfer(recipient, allocation)`.

## TokenOps Boundary

The frontend includes a `TokenOpsAdapter` boundary backed by the official npm package:

- `@tokenops/sdk`
- `@tokenops/sdk/fhe-airdrop`
- `@tokenops/sdk/fhe-disperse`

The adapter resolves the TokenOps Sepolia confidential airdrop factory and confidential disperse singleton from the SDK registry. In live mode, it can:

1. Create a TokenOps confidential airdrop through `createConfidentialAirdropFactoryClient`.
2. Encrypt each recipient allocation with `encryptUint64`.
3. Sign EIP-712 recipient claim authorizations with `signClaimAuthorization`.
4. Return recipient claim packets containing the encrypted input, signature, and delivery URL.

For local judging without wallet/RPC/relayer credentials, the same adapter runs a deterministic demo runtime that keeps the UI honest about execution mode while preserving the exact claim-packet workflow.

## Zama SDK Boundary

The frontend includes `ZamaClientAdapter` functions for:

- registry token discovery
- shielding ERC-20 into ERC-7984 wrappers
- confidential balance decryption
- recipient allocation decryption
- confidential claims

The demo adapter mirrors the current Zama SDK flow documented in the quick start:

```ts
const token = sdk.createToken("0xConfidentialToken");
await token.shield(1000n);
const balance = await token.balanceOf();
await token.confidentialTransfer("0xRecipient", 500n);
```

## Production Deployment Checklist

- Deploy `ShieldDropFactory` to Sepolia with registry `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`.
- Set `VITE_SHIELDDROP_FACTORY_ADDRESS`.
- Configure `VITE_SEPOLIA_RPC_URL`.
- Proxy the Zama relayer behind `/api/relayer/11155111` so API keys stay server-side.
- Supply viem public/wallet clients and the Zama encryptor to `frontend/src/lib/tokenops.ts` for live TokenOps execution.
- Run a full cUSDTMock claim demo with three recipients.

## Judge-Facing Differentiators

- Purpose-built for TokenOps Special Bounty, but substantial enough for Builder Track.
- Registry-first: surfaces and uses official Sepolia wrappers.
- UX-first: campaign creator, TokenOps preflight, claim-packet delivery, claim page, private analytics, wrapper registry, and audit export.
- Clear security model: individual allocations private, claim status public, recipient decrypts only their own allocation.
