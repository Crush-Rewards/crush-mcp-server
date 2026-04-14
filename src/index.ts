#!/usr/bin/env node

// Handle --help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  const { printHelp } = await import("./setup.js");
  printHelp();
  process.exit(0);
}

// Handle --setup flag
if (process.argv.includes("--setup")) {
  const { runSetup } = await import("./setup.js");
  await runSetup();
  process.exit(0);
}

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadOrCreateWallet } from "./lib/wallet.js";

const DEFAULT_API_BASE = "https://api.crushrewards.dev";
const rawApiBase = process.env.CRUSH_API_BASE ?? DEFAULT_API_BASE;

// CRUSH_API_BASE controls where we sign and send USDC payments. A malicious or
// accidental override could redirect funds to an attacker. Refuse non-HTTPS,
// require explicit opt-in for any non-default origin.
let parsedApiBase: URL;
try {
  parsedApiBase = new URL(rawApiBase);
} catch {
  console.error(`CRUSH_API_BASE is not a valid URL: ${rawApiBase}`);
  process.exit(1);
}
if (parsedApiBase.protocol !== "https:") {
  console.error(
    `CRUSH_API_BASE must use https:// (got ${parsedApiBase.protocol}). ` +
    `Refusing to sign USDC payments over plaintext.`,
  );
  process.exit(1);
}
if (rawApiBase !== DEFAULT_API_BASE && process.env.CRUSH_ALLOW_CUSTOM_API !== "1") {
  console.error(
    `⚠️  CRUSH_API_BASE override detected: ${rawApiBase}\n` +
    `   This endpoint will receive signed USDC payments.\n` +
    `   Set CRUSH_ALLOW_CUSTOM_API=1 to acknowledge.`,
  );
  process.exit(1);
}
const apiBase = rawApiBase;
const apiKey = process.env.CRUSH_API_KEY;

// Env vars still supported as overrides for advanced users (CI, shared secrets,
// read-only home dirs). If *both* are provided, we skip the wallet file entirely —
// preserving v0.2.x behavior where env-only users never had a wallet.json created.
if (!process.env.CRUSH_EVM_PRIVATE_KEY && process.env.CRUSH_WALLET_PRIVATE_KEY) {
  console.error(
    "⚠️  CRUSH_WALLET_PRIVATE_KEY is deprecated; rename to CRUSH_EVM_PRIVATE_KEY. " +
    "Legacy alias will be removed in a future release.",
  );
}
const envEvmKey = process.env.CRUSH_EVM_PRIVATE_KEY ?? process.env.CRUSH_WALLET_PRIVATE_KEY;
const envSolanaKey = process.env.CRUSH_SOLANA_PRIVATE_KEY;

let evmPrivateKey: string;
let solanaPrivateKey: string;

if (envEvmKey && envSolanaKey) {
  evmPrivateKey = envEvmKey;
  solanaPrivateKey = envSolanaKey;
} else {
  // At least one key missing → load (and maybe generate) wallet file
  const { wallet, isNew, migrated } = await loadOrCreateWallet();
  evmPrivateKey = envEvmKey ?? wallet.evmPrivateKey;
  solanaPrivateKey = envSolanaKey ?? wallet.solanaPrivateKey;

  if (isNew) {
    console.error([
      "",
      "  New multi-chain wallet generated for Crush Pricing Intelligence API",
      "",
      "  Base / Tempo (EVM): " + wallet.evmAddress,
      "  Solana:             " + wallet.solanaAddress,
      "",
      "  Fund any of the above — the server auto-picks the chain with balance.",
      "  Run `npx @crush-rewards/mcp-server --setup` to see private keys for import.",
      "  Saved to: ~/.crush/wallet.json",
      "",
    ].join("\n"));
  } else if (migrated) {
    console.error([
      "",
      "  Wallet migrated to multi-chain format (existing keys preserved).",
      "",
      "    Base / Tempo (EVM): " + wallet.evmAddress,
      "    Solana:             " + wallet.solanaAddress,
      "",
    ].join("\n"));
  }
}

const server = await createServer({ apiBase, evmPrivateKey, solanaPrivateKey, apiKey });
const transport = new StdioServerTransport();
await server.connect(transport);
