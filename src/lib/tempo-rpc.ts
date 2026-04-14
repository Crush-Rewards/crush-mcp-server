const ERC20_BALANCE_OF_SELECTOR = "0x70a08231";
// Matches the Solana helper's ceiling. For a 6-decimal token this caps the
// reported balance at ~10^12 tokens — still generous, but tight enough that a
// malicious RPC can't trivially spoof an infinite balance to keep us on a
// chain we can't actually pay on.
const MAX_ATOMIC_AMOUNT = 10n ** 18n;
const DEFAULT_TIMEOUT_MS = 2000;

function pad32(hexWithoutPrefix: string): string {
  return hexWithoutPrefix.padStart(64, "0");
}

interface RpcCallResponse {
  jsonrpc?: string;
  id?: number;
  result?: string;
  error?: { code: number; message: string };
}

/**
 * Reads an ERC-20 balance via `eth_call` on any EVM RPC. Used here for Tempo
 * USDC.e balance checks. Returns the raw atomic amount.
 *
 * Throws on any RPC failure (timeout, HTTP error, RPC error, malformed
 * response, implausibly large value) so the caller can choose to degrade
 * gracefully — we never want a flaky RPC to gate payments.
 */
export async function getErc20Balance(
  rpcUrl: string,
  tokenAddress: string,
  owner: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<bigint> {
  const ownerClean = owner.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(ownerClean)) {
    throw new Error("Invalid owner address");
  }
  const tokenClean = tokenAddress.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(tokenClean)) {
    throw new Error("Invalid token address");
  }

  const data = ERC20_BALANCE_OF_SELECTOR + pad32(ownerClean);

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: tokenClean, data }, "latest"],
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

  const json = (await res.json()) as RpcCallResponse;

  if (json.error) {
    throw new Error(`RPC error ${json.error.code}`);
  }

  const result = json.result;
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result)) {
    throw new Error("Malformed RPC response");
  }

  const amount = BigInt(result);
  if (amount < 0n || amount > MAX_ATOMIC_AMOUNT) {
    throw new Error("Implausible balance");
  }
  return amount;
}
