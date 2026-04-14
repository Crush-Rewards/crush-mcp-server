import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { Mppx, tempo } from "mppx/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";

interface FetchConfig {
  evmPrivateKey: string;
  solanaPrivateKey: string;
}

/**
 * Creates a fetch function that handles 402 Payment Required challenges across
 * all three supported chains:
 *
 * - Base (x402 EVM) — USDC on Base mainnet, chain 8453
 * - Solana (x402 SVM) — USDC on Solana mainnet
 * - Tempo (MPP) — USDC.e on Tempo, reuses the EVM account
 *
 * Pipeline: `fetch → x402 → mppx`
 *
 * Mppx polyfills globalThis.fetch by default — we disable that to keep things
 * explicit, and pass x402Fetch as its base so MPP challenges fall through
 * cleanly when the server prefers x402.
 */
/**
 * Upstream libraries (viem, @solana/kit, @scure/base) generally don't embed key
 * material in their error messages, but they're black boxes. Strip any substring
 * that looks like a private key from the error reason before surfacing it.
 */
function sanitizeReason(err: unknown, ...secrets: string[]): string {
  let msg = err instanceof Error ? err.message : String(err);
  for (const s of secrets) {
    if (s && msg.includes(s)) msg = msg.split(s).join("[redacted]");
  }
  // Belt-and-braces: also redact anything that looks like a long hex or base58 blob.
  msg = msg.replace(/0x[0-9a-fA-F]{32,}/g, "[redacted]");
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}

export interface PaidFetchResult {
  fetch: typeof globalThis.fetch;
  /** Validated EVM address (Base + Tempo). */
  evmAddress: `0x${string}`;
  /** Validated Solana base58 address. */
  solanaAddress: string;
}

export async function createPaidFetch(config: FetchConfig): Promise<PaidFetchResult> {
  let evmAccount: ReturnType<typeof privateKeyToAccount>;
  try {
    evmAccount = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
  } catch (err) {
    throw new Error(
      `EVM private key is malformed (${sanitizeReason(err, config.evmPrivateKey)}). ` +
      `Delete ~/.crush/wallet.json and re-run \`npx @crush-rewards/mcp-server --setup\`, ` +
      `or set CRUSH_EVM_PRIVATE_KEY to a valid 0x-prefixed key.`,
    );
  }

  // --- x402 client (Base + Solana) ---
  const x402 = new x402Client();
  x402.register("eip155:8453", new ExactEvmScheme(evmAccount));

  let signer: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;
  try {
    const { base58 } = await import("@scure/base");
    const secretBytes = base58.decode(config.solanaPrivateKey);
    signer = await createKeyPairSignerFromBytes(secretBytes);
  } catch (err) {
    throw new Error(
      `Solana private key is malformed (${sanitizeReason(err, config.solanaPrivateKey)}). ` +
      `Delete ~/.crush/wallet.json and re-run \`npx @crush-rewards/mcp-server --setup\`, ` +
      `or set CRUSH_SOLANA_PRIVATE_KEY to a valid base58 key.`,
    );
  }
  registerExactSvmScheme(x402, {
    signer,
    networks: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
  });

  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, x402);

  // --- MPP (Tempo) — chains on top of x402Fetch ---
  const mppx = Mppx.create({
    methods: [tempo({ account: evmAccount })],
    fetch: x402Fetch,
    polyfill: false,
  });

  return {
    fetch: mppx.fetch,
    evmAddress: evmAccount.address,
    solanaAddress: signer.address,
  };
}
