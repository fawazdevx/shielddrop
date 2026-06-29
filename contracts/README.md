# ShieldDrop Contracts

## Install Dependencies

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install zama-ai/fhevm-solidity --no-git
```

Your deploy error was caused by missing project libraries, not by Foundry itself. The project must have:

- `contracts/lib/forge-std/src/Script.sol`
- `contracts/lib/fhevm-solidity/lib/FHE.sol`
- `contracts/lib/fhevm-solidity/config/FHEVMConfig.sol`

If `forge install` says the destination path already exists and is not empty, do not reinstall that package. Check that the files above exist and run the build.

Then run:

```bash
forge build
```

## Deploy Sepolia Factory With Proxy

Use this for the bounty demo if you want upgradeability. It deploys:

- `ShieldDropFactory` implementation
- `ShieldDropFactoryProxy` ERC1967 proxy
- proxy storage initialized with the Sepolia wrapper registry and `OWNER_ADDRESS`

Using your keystore account style:

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

One-line version:

```bash
forge script script/Deploy.s.sol:DeployShieldDropProxy --rpc-url $SEPOLIA_RPC_URL --chain-id $SEPOLIA_CHAIN_ID --account deploytestKey --sender $OWNER_ADDRESS --broadcast -vvv
```

With verification:

```bash
forge script script/Deploy.s.sol:DeployShieldDropProxy \
  --rpc-url $SEPOLIA_RPC_URL \
  --chain-id $SEPOLIA_CHAIN_ID \
  --account deploytestKey \
  --sender $OWNER_ADDRESS \
  --broadcast \
  --verify \
  -vvv
```

Set `VITE_SHIELDDROP_FACTORY_ADDRESS` to the proxy address, not the implementation address.

## Deploy Sepolia Factory Without Proxy

The direct deploy path is still available for a simple immutable factory:

```bash
forge script script/Deploy.s.sol:DeployShieldDrop \
  --rpc-url $SEPOLIA_RPC_URL \
  --chain-id $SEPOLIA_CHAIN_ID \
  --account deploytestKey \
  --sender $OWNER_ADDRESS \
  --broadcast \
  -vvv
```

If you deploy with a raw private key instead:

```bash
forge script script/Deploy.s.sol:DeployShieldDropProxy \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

The deploy script uses the official Sepolia wrappers registry:

`0x2f0750Bbb0A246059d80e94c454586a7F27a128e`
