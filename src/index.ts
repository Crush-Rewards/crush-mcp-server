#!/usr/bin/env node

// Handle --setup flag before anything else
if (process.argv.includes("--setup")) {
  const { runSetup } = await import("./setup.js");
  await runSetup();
  process.exit(0);
}

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadOrCreateWallet } from "./lib/wallet.js";

const apiBase =
  process.env.CRUSH_API_BASE ?? "https://api.crushrewards.dev";
const apiKey = process.env.CRUSH_API_KEY;

let evmPrivateKey = process.env.CRUSH_EVM_PRIVATE_KEY ?? process.env.CRUSH_WALLET_PRIVATE_KEY;
const solanaPrivateKey = process.env.CRUSH_SOLANA_PRIVATE_KEY;

if (!evmPrivateKey && !solanaPrivateKey) {
  const wallet = await loadOrCreateWallet();
  evmPrivateKey = wallet.privateKey;

  if (wallet.isNew) {
    console.error([
      "",
      "  New wallet generated for Crush Pricing Intelligence API",
      "",
      "  Address: " + wallet.address,
      "  Saved to: ~/.crush/wallet.json",
      "",
      "  Fund this address with USDC on Base to start querying.",
      "  Get USDC: https://www.coinbase.com or any Base bridge",
      "  Even $1 gets you 50-200 queries.",
      "",
    ].join("\n"));
  }
}

const server = await createServer({ apiBase, evmPrivateKey, solanaPrivateKey, apiKey });
const transport = new StdioServerTransport();
await server.connect(transport);
