import { wrapperPairs } from "./constants";
import type { Address, Recipient, WrapperPair } from "./types";

export type DecryptionResult = {
  handle: string;
  amount: bigint;
  signature: string;
};

export interface ZamaClientAdapter {
  listWrapperPairs(): Promise<WrapperPair[]>;
  encryptAllocations(campaignAddress: Address, recipients: Recipient[]): Promise<Recipient[]>;
  decryptAllocation(handle: string, recipient: Recipient): Promise<DecryptionResult>;
  requestFaucet(underlyingToken: Address, recipient: Address): Promise<string>;
}

export class DemoZamaClientAdapter implements ZamaClientAdapter {
  async listWrapperPairs() {
    await wait(250);
    return wrapperPairs;
  }

  async encryptAllocations(campaignAddress: Address, recipients: Recipient[]) {
    await wait(700);
    return recipients.map((recipient, index) => ({
      ...recipient,
      encryptedHandle: `0x${campaignAddress.slice(2, 8)}...${(index + 4096).toString(16)}`
    }));
  }

  async decryptAllocation(handle: string, recipient: Recipient) {
    await wait(650);
    return {
      handle,
      amount: recipient.amount,
      signature: `eip712:${recipient.address.slice(2, 10)}:${Date.now().toString(16)}`
    };
  }

  async requestFaucet(underlyingToken: Address, recipient: Address) {
    await wait(500);
    return `mint:${underlyingToken.slice(0, 10)}:${recipient.slice(0, 10)}:${Date.now().toString(16)}`;
  }
}

export function createZamaClient(): ZamaClientAdapter {
  return new DemoZamaClientAdapter();
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
