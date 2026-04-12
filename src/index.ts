#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiBase =
  process.env.CRUSH_API_BASE ?? "https://api.crushrewards.dev";
const privateKey = process.env.CRUSH_WALLET_PRIVATE_KEY;
const apiKey = process.env.CRUSH_API_KEY;

if (!privateKey) {
  console.error(
    "Error: CRUSH_WALLET_PRIVATE_KEY is required.\n" +
      "Set it to a 0x-prefixed private key for a Base wallet with USDC.\n" +
      "Example: CRUSH_WALLET_PRIVATE_KEY=0xabc123... crush-mcp",
  );
  process.exit(1);
}

const server = createServer({ apiBase, privateKey, apiKey });
const transport = new StdioServerTransport();
await server.connect(transport);
