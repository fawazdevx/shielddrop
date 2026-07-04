import type { SepoliaEncryptorWeb } from "@tokenops/sdk/fhe";
import { createConfidentialAirdropClient, type EncryptedInput } from "@tokenops/sdk/fhe-airdrop";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { TokenOpsSdkAdapter, type TokenOpsAdapter, type TokenOpsMode } from "./tokenops";
import type { Recipient } from "./types";
import { DemoZamaClientAdapter } from "./zama";
import { decryptHandle, initEncryptor } from "./zama-live";

const SEPOLIA_ID = 11155111;

export type RuntimeStatus = "demo" | "initializing" | "live" | "error";

/** Everything the recipient decrypt/claim flow needs to talk to a live clone. */
export type ClaimContext = {
  airdropAddress: Address;
  encryptedInput: EncryptedInput;
  signature: Hex;
};

export type DistributionRuntime = {
  status: RuntimeStatus;
  runtime: "demo" | "live";
  account?: Address;
  tokenOps: TokenOpsAdapter;
  /** Decrypt an allocation. Live: relayer userDecrypt of the ACL-granted handle. Demo: echoes the known amount. */
  revealAllocation(recipient: Recipient, ctx?: ClaimContext): Promise<bigint>;
  /** Submit a confidential claim. Live: real Sepolia tx. Demo: no-op hash. */
  submitClaim(ctx?: ClaimContext): Promise<Hex>;
};

/**
 * Bridges wagmi's connected clients into the TokenOps + Zama adapters. When a
 * wallet is connected on Sepolia and the relayer initializes, the app runs the
 * real onchain path; otherwise it gracefully falls back to demo mode so the UI
 * never breaks.
 */
export function useDistributionRuntime(mode: TokenOpsMode = "confidential-airdrop"): DistributionRuntime {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [encryptor, setEncryptor] = useState<SepoliaEncryptorWeb | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>("demo");
  const demoZama = useRef(new DemoZamaClientAdapter());

  const onSepolia = chainId === SEPOLIA_ID;
  const canGoLive = Boolean(address && publicClient && walletClient && onSepolia);

  useEffect(() => {
    let cancelled = false;
    if (!canGoLive || !address || !publicClient || !walletClient) {
      setEncryptor(null);
      setStatus("demo");
      return;
    }
    setStatus("initializing");
    initEncryptor(publicClient, walletClient, address)
      .then((enc) => {
        if (cancelled) return;
        setEncryptor(enc);
        setStatus("live");
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[shielddrop] relayer init failed, staying in demo mode", error);
        setEncryptor(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [address, publicClient, walletClient, canGoLive]);

  const live = status === "live" && Boolean(encryptor && walletClient && publicClient && address);

  const tokenOps = useMemo<TokenOpsAdapter>(() => {
    if (live && encryptor && walletClient && publicClient && address) {
      return new TokenOpsSdkAdapter({ publicClient, walletClient, encryptor, account: address, mode });
    }
    return new TokenOpsSdkAdapter({ mode });
  }, [live, encryptor, walletClient, publicClient, address, mode]);

  async function revealAllocation(recipient: Recipient, ctx?: ClaimContext): Promise<bigint> {
    if (live && encryptor && walletClient && publicClient && address && ctx) {
      const airdrop = createConfidentialAirdropClient({
        publicClient,
        walletClient,
        address: ctx.airdropAddress
      });
      const { handle } = await airdrop.getClaimAmount({
        encryptedInput: ctx.encryptedInput,
        signature: ctx.signature
      });
      return decryptHandle({
        encryptor,
        walletClient,
        account: address,
        contractAddress: ctx.airdropAddress,
        handle
      });
    }
    const res = await demoZama.current.decryptAllocation(recipient.encryptedHandle, recipient);
    return res.amount;
  }

  async function submitClaim(ctx?: ClaimContext): Promise<Hex> {
    if (live && walletClient && publicClient && ctx) {
      const airdrop = createConfidentialAirdropClient({
        publicClient,
        walletClient,
        address: ctx.airdropAddress
      });
      return airdrop.claim({ encryptedInput: ctx.encryptedInput, signature: ctx.signature });
    }
    return `0x${"0".repeat(64)}` as Hex;
  }

  return {
    status,
    runtime: live ? "live" : "demo",
    account: address,
    tokenOps,
    revealAllocation,
    submitClaim
  };
}
