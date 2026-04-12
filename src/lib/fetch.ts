import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";

interface FetchConfig {
  evmPrivateKey?: string;
  solanaPrivateKey?: string;
}

export async function createPaidFetch(config: FetchConfig): Promise<typeof globalThis.fetch> {
  const client = new x402Client();

  if (config.evmPrivateKey) {
    const account = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
    client.register("eip155:8453", new ExactEvmScheme(account));
  }

  if (config.solanaPrivateKey) {
    // Decode base58 private key to bytes
    const { base58 } = await import("@scure/base");
    const secretBytes = base58.decode(config.solanaPrivateKey);
    const signer = await createKeyPairSignerFromBytes(secretBytes);
    registerExactSvmScheme(client, {
      signer,
      networks: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    });
  }

  return wrapFetchWithPayment(globalThis.fetch, client);
}
