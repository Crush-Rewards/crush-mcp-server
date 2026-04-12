import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createPaidFetch } from "./lib/fetch.js";
import { countrySchema, retailerSchema, daysSchema } from "./lib/schemas.js";
import { loadOrCreateWallet } from "./lib/wallet.js";
import { privateKeyToAccount } from "viem/accounts";

export interface ServerConfig {
  apiBase: string;
  evmPrivateKey?: string;
  solanaPrivateKey?: string;
  apiKey?: string;
}

export async function createServer(config: ServerConfig): Promise<McpServer> {
  const server = new McpServer({
    name: "crush-pricing-intelligence",
    version: "0.2.0",
  });

  const paidFetch = await createPaidFetch({
    evmPrivateKey: config.evmPrivateKey,
    solanaPrivateKey: config.solanaPrivateKey,
  });

  // ── Wallet info tool ────────────────────────────────────────────

  server.tool(
    "wallet_info",
    "Show your wallet address and funding instructions. Call this if a payment fails or to check your wallet.",
    {},
    async () => {
      const lines: string[] = [];

      if (config.evmPrivateKey) {
        const account = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
        lines.push("Base (EVM) wallet: " + account.address);
        lines.push("  Fund with USDC on Base: https://www.coinbase.com or any Base bridge");
      }

      if (config.solanaPrivateKey) {
        lines.push("Solana wallet: configured");
      }

      if (!config.evmPrivateKey && !config.solanaPrivateKey) {
        const wallet = await loadOrCreateWallet();
        lines.push("Auto-generated Base wallet: " + wallet.address);
        lines.push("Fund with USDC on Base to start making queries.");
      }

      lines.push("");
      lines.push("Each query costs 0.005-0.02 USDC. Even 1 USDC gets you 50-200 queries.");

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  async function query(path: string, params: Record<string, string | undefined>) {
    const url = new URL(path, config.apiBase);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {};
    if (config.apiKey) headers["X-API-Key"] = config.apiKey;

    const res = await paidFetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text();
      return {
        content: [{ type: "text" as const, text: `Error ${res.status}: ${text}` }],
        isError: true,
      };
    }

    const data = await res.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  }

  // ── Shopper ($0.005/query) ──────────────────────────────────────

  server.tool(
    "best_price",
    "Find the best current price for a product across retailers. Costs $0.005.",
    { q: z.string().describe("Product search query"), country: countrySchema, retailer: retailerSchema },
    async ({ q, country, retailer }) => query("/v1/shopper/best-price", { q, country, retailer }),
  );

  server.tool(
    "price_history",
    "Get price history for a product over time. Costs $0.005.",
    { q: z.string().describe("Product search query"), country: countrySchema, retailer: retailerSchema, days: daysSchema },
    async ({ q, country, retailer, days }) =>
      query("/v1/shopper/price-history", { q, country, retailer, days: days?.toString() }),
  );

  server.tool(
    "deal_finder",
    "Find current deals and discounts in a product category. Costs $0.005.",
    { category: z.string().describe("Product category (e.g. electronics, grocery)"), country: countrySchema, retailer: retailerSchema },
    async ({ category, country, retailer }) => query("/v1/shopper/deal-finder", { category, country, retailer }),
  );

  server.tool(
    "price_drop_alert",
    "Check for recent price drops on a product. Costs $0.005.",
    { q: z.string().describe("Product search query"), country: countrySchema, retailer: retailerSchema, days: daysSchema },
    async ({ q, country, retailer, days }) =>
      query("/v1/shopper/price-drop-alert", { q, country, retailer, days: days?.toString() }),
  );

  // ── Marketing ($0.01/query) ─────────────────────────────────────

  server.tool(
    "competitive_landscape",
    "Get competitive pricing landscape for a category. Costs $0.01.",
    { category: z.string().describe("Product category"), country: countrySchema, retailer: retailerSchema },
    async ({ category, country, retailer }) =>
      query("/v1/marketing/competitive-landscape", { category, country, retailer }),
  );

  server.tool(
    "brand_tracker",
    "Track a brand's pricing and market positioning. Costs $0.01.",
    { brand: z.string().describe("Brand name (e.g. Sony, Samsung)"), country: countrySchema, retailer: retailerSchema, days: daysSchema },
    async ({ brand, country, retailer, days }) =>
      query("/v1/marketing/brand-tracker", { brand, country, retailer, days: days?.toString() }),
  );

  server.tool(
    "promo_intelligence",
    "Get promotional activity intelligence for a category. Costs $0.01.",
    { category: z.string().describe("Product category"), country: countrySchema, retailer: retailerSchema, days: daysSchema },
    async ({ category, country, retailer, days }) =>
      query("/v1/marketing/promo-intelligence", { category, country, retailer, days: days?.toString() }),
  );

  server.tool(
    "share_of_shelf",
    "Analyze brand share of shelf in a category. Costs $0.01.",
    { category: z.string().describe("Product category"), country: countrySchema, retailer: retailerSchema },
    async ({ category, country, retailer }) =>
      query("/v1/marketing/share-of-shelf", { category, country, retailer }),
  );

  server.tool(
    "price_positioning",
    "Analyze a brand's price positioning vs competitors. Costs $0.01.",
    { brand: z.string().describe("Brand name"), country: countrySchema, retailer: retailerSchema },
    async ({ brand, country, retailer }) =>
      query("/v1/marketing/price-positioning", { brand, country, retailer }),
  );

  // ── Analyst ($0.02/query) ───────────────────────────────────────

  server.tool(
    "inflation_tracker",
    "Track price inflation trends in a category. Costs $0.02.",
    { category: z.string().describe("Product category"), country: countrySchema, days: daysSchema },
    async ({ category, country, days }) =>
      query("/v1/analyst/inflation", { category, country, days: days?.toString() }),
  );

  server.tool(
    "shrinkflation_detector",
    "Detect shrinkflation patterns in a category. Costs $0.02.",
    { category: z.string().describe("Product category"), country: countrySchema, days: daysSchema },
    async ({ category, country, days }) =>
      query("/v1/analyst/shrinkflation", { category, country, days: days?.toString() }),
  );

  server.tool(
    "price_dispersion",
    "Analyze price variance across retailers for a category. Costs $0.02.",
    { category: z.string().describe("Product category"), country: countrySchema, retailer: retailerSchema },
    async ({ category, country, retailer }) =>
      query("/v1/analyst/price-dispersion", { category, country, retailer }),
  );

  server.tool(
    "retailer_index",
    "Get a pricing index for a specific retailer. Costs $0.02.",
    { retailer: z.string().describe("Retailer name (e.g. amazon, walmart)"), country: countrySchema, days: daysSchema },
    async ({ retailer, country, days }) =>
      query("/v1/analyst/retailer-index", { retailer, country, days: days?.toString() }),
  );

  server.tool(
    "category_summary",
    "Get a comprehensive pricing summary for a category. Costs $0.02.",
    { category: z.string().describe("Product category"), country: countrySchema, retailer: retailerSchema, days: daysSchema },
    async ({ category, country, retailer, days }) =>
      query("/v1/analyst/category-summary", { category, country, retailer, days: days?.toString() }),
  );

  return server;
}
