import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";

const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// 10^18 atomic units is well beyond any plausible USDC balance (USDC has 6 decimals,
// so this caps us at ~10^12 USDC). Protects against a malicious RPC falsely claiming
// we have enough balance to skip falling through to the next chain.
const MAX_ATOMIC_AMOUNT = 10n ** 18n;

const DEFAULT_TIMEOUT_MS = 2000;

export async function deriveAssociatedTokenAccount(
  owner: Address,
  mint: Address,
): Promise<Address> {
  const enc = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    seeds: [enc.encode(owner), enc.encode(TOKEN_PROGRAM), enc.encode(mint)],
  });
  return ata;
}

interface RpcBalanceResponse {
  jsonrpc?: string;
  id?: number;
  result?: { context?: unknown; value?: { amount?: string; decimals?: number } };
  error?: { code: number; message: string };
}

/**
 * Reads the SPL-token balance of a single account via JSON-RPC. Returns the
 * raw atomic amount. Returns 0n when the account does not exist (RPC surfaces
 * this as a "could not find account" error, not a zero-valued result).
 *
 * Throws on any other failure (network, timeout, malformed response,
 * implausibly large value) so the caller can decide how to degrade gracefully.
 */
export async function getTokenAccountBalance(
  rpcUrl: string,
  account: Address,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<bigint> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountBalance",
    params: [account, { commitment: "confirmed" }],
  });

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }

  const json = (await res.json()) as RpcBalanceResponse;

  if (json.error) {
    const msg = typeof json.error.message === "string" ? json.error.message.toLowerCase() : "";
    // Account-not-found is expected when a user's ATA hasn't been initialized yet — no USDC
    // has ever been sent to them. Treat as zero balance. Providers word this differently
    // (Helius/Triton/QuickNode), so we also accept the JSON-RPC "invalid params" code that
    // Solana returns for nonexistent accounts in this endpoint.
    if (
      json.error.code === -32602 ||
      msg.includes("could not find account") ||
      msg.includes("invalid account") ||
      msg.includes("not found")
    ) {
      return 0n;
    }
    throw new Error(`RPC error ${json.error.code}`);
  }

  const amountStr = json.result?.value?.amount;
  if (typeof amountStr !== "string" || !/^\d+$/.test(amountStr)) {
    throw new Error("Malformed RPC response");
  }

  const amount = BigInt(amountStr);
  if (amount < 0n || amount > MAX_ATOMIC_AMOUNT) {
    throw new Error("Implausible balance");
  }
  return amount;
}
