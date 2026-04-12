import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

export function createPaidFetch(privateKey: string): typeof globalThis.fetch {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = new x402Client();
  client.register("eip155:8453", new ExactEvmScheme(account));

  return wrapFetchWithPayment(globalThis.fetch, client);
}
