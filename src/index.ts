#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiBase =
  process.env.CRUSH_API_BASE ?? "https://api.crushrewards.dev";
const evmPrivateKey = process.env.CRUSH_EVM_PRIVATE_KEY ?? process.env.CRUSH_WALLET_PRIVATE_KEY;
const solanaPrivateKey = process.env.CRUSH_SOLANA_PRIVATE_KEY;
const apiKey = process.env.CRUSH_API_KEY;

if (!evmPrivateKey && !solanaPrivateKey) {
  console.error(
    "Error: At least one wallet key is required.\n" +
      "  CRUSH_EVM_PRIVATE_KEY     — 0x-prefixed Base wallet key (for x402 on Base)\n" +
      "  CRUSH_SOLANA_PRIVATE_KEY  — base58 Solana wallet key (for x402 on Solana)\n" +
      "  CRUSH_WALLET_PRIVATE_KEY  — alias for CRUSH_EVM_PRIVATE_KEY\n",
  );
  process.exit(1);
}

const server = await createServer({ apiBase, evmPrivateKey, solanaPrivateKey, apiKey });
const transport = new StdioServerTransport();
await server.connect(transport);
