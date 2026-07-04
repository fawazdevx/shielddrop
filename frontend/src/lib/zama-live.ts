import { createSepoliaEncryptorWeb, type SepoliaEncryptorWeb } from "@tokenops/sdk/fhe";
import type { Address, Hex, PublicClient, WalletClient } from "viem";

/**
 * Live FHE wiring for ShieldDrop.
 *
 * The encryptor is produced by TokenOps's browser helper, which builds a Zama
 * `RelayerWeb` under the hood and exposes it as `.instance`. We talk to that
 * instance directly for user-decryption (the structural `Encryptor` contract
 * only covers encryption). The shape below mirrors `@zama-fhe/sdk` v3 so we
 * don't have to import the optional peer dep's types.
 */

type TransportKeyPair = { publicKey: Hex; privateKey: Hex };

type Eip712TypedData = {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  message: Record<string, unknown>;
  primaryType?: string;
};

type RelayerWebInstance = {
  generateTransportKeyPair(): Promise<TransportKeyPair>;
  createEIP712(
    publicKey: Hex,
    contractAddresses: Address[],
    startTimestamp: number,
    durationDays?: number
  ): Promise<Eip712TypedData>;
  userDecrypt(params: {
    encryptedValues: Hex[];
    contractAddress: Address;
    signedContractAddresses: Address[];
    privateKey: Hex;
    publicKey: Hex;
    signature: Hex;
    signerAddress: Address;
    startTimestamp: number;
    durationDays: number;
  }): Promise<Readonly<Record<string, bigint | boolean | string>>>;
};

let encryptorPromise: Promise<SepoliaEncryptorWeb> | null = null;
let encryptorKey = "";

/**
 * Build (and memoize) the Sepolia browser encryptor. Re-initializes only when
 * the connected account or chain changes. Throws if the relayer/WASM fails to
 * load — callers fall back to demo mode on error.
 */
export function initEncryptor(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: Address
): Promise<SepoliaEncryptorWeb> {
  const key = `${account.toLowerCase()}:${publicClient.chain?.id ?? "?"}`;
  if (encryptorPromise && encryptorKey === key) {
    return encryptorPromise;
  }
  if (encryptorPromise) {
    void encryptorPromise.then((enc) => enc.terminate()).catch(() => undefined);
  }
  encryptorKey = key;
  encryptorPromise = createSepoliaEncryptorWeb({ publicClient, walletClient });
  return encryptorPromise;
}

export function resetEncryptor() {
  if (encryptorPromise) {
    void encryptorPromise.then((enc) => enc.terminate()).catch(() => undefined);
  }
  encryptorPromise = null;
  encryptorKey = "";
}

const PERMIT_DURATION_DAYS = 7;

/**
 * Run the Zama user-decryption flow for a single encrypted handle the caller
 * has been granted ACL access to. Returns the plaintext allocation.
 */
export async function decryptHandle({
  encryptor,
  walletClient,
  account,
  contractAddress,
  handle
}: {
  encryptor: SepoliaEncryptorWeb;
  walletClient: WalletClient;
  account: Address;
  contractAddress: Address;
  handle: Hex;
}): Promise<bigint> {
  const relayer = encryptor.instance as RelayerWebInstance;
  const keypair = await relayer.generateTransportKeyPair();
  const startTimestamp = Math.floor(Date.now() / 1000);

  const eip712 = await relayer.createEIP712(
    keypair.publicKey,
    [contractAddress],
    startTimestamp,
    PERMIT_DURATION_DAYS
  );

  const primaryType = eip712.primaryType ?? "UserDecryptRequestVerification";
  // viem rejects an EIP712Domain entry in `types`; pass only the request type.
  const { EIP712Domain: _domain, ...messageTypes } = eip712.types;

  const signature = await walletClient.signTypedData({
    account,
    domain: eip712.domain,
    types: messageTypes,
    primaryType,
    message: eip712.message
  } as Parameters<WalletClient["signTypedData"]>[0]);

  const result = await relayer.userDecrypt({
    encryptedValues: [handle],
    contractAddress,
    signedContractAddresses: [contractAddress],
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
    signature,
    signerAddress: account,
    startTimestamp,
    durationDays: PERMIT_DURATION_DAYS
  });

  const clear = result[handle];
  return typeof clear === "bigint" ? clear : BigInt(clear as string | number);
}
