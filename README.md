# Crush Pricing Intelligence MCP Server

MCP server that gives AI agents access to real-time competitive pricing data across Amazon, Walmart, Costco, and more. Pay-per-query via [x402](https://x402.org) micropayments (USDC on Base).

## Quick Start

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "crush-pricing": {
      "command": "npx",
      "args": ["-y", "@crush-rewards/mcp-server"],
      "env": {
        "CRUSH_WALLET_PRIVATE_KEY": "0x_YOUR_BASE_WALLET_PRIVATE_KEY",
        "CRUSH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

### Requirements

- **Base wallet with USDC** — for x402 micropayments ($0.005-$0.02 per query)
- **API key** — request at [crushrewards.dev](https://crushrewards.dev)

## Tools

### Shopper ($0.005/query)

| Tool | Description |
|------|-------------|
| `best_price` | Find the cheapest price for a product across retailers |
| `price_history` | Get price trends over time |
| `deal_finder` | Find current deals in a category |
| `price_drop_alert` | Check for recent price drops |

### Marketing ($0.01/query)

| Tool | Description |
|------|-------------|
| `competitive_landscape` | Competitive pricing overview for a category |
| `brand_tracker` | Track a brand's pricing and positioning |
| `promo_intelligence` | Promotional activity intelligence |
| `share_of_shelf` | Brand share of shelf analysis |
| `price_positioning` | Brand price positioning vs competitors |

### Analyst ($0.02/query)

| Tool | Description |
|------|-------------|
| `inflation_tracker` | Category price inflation trends |
| `shrinkflation_detector` | Detect shrinkflation patterns |
| `price_dispersion` | Price variance across retailers |
| `retailer_index` | Pricing index for a retailer |
| `category_summary` | Comprehensive category pricing summary |

## Parameters

All tools accept optional parameters:

| Parameter | Description |
|-----------|-------------|
| `country` | `us` or `ca` (defaults to `us`) |
| `retailer` | Filter to a specific retailer (e.g. `amazon`, `walmart`, `costco`) |
| `days` | Number of days to look back (where applicable) |

## Configuration

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `CRUSH_WALLET_PRIVATE_KEY` | Yes | 0x-prefixed private key for a Base wallet with USDC |
| `CRUSH_API_KEY` | Yes | API key for the Crush Pricing API |
| `CRUSH_API_BASE` | No | API base URL (defaults to `https://api.crushrewards.dev`) |

## How It Works

1. You call an MCP tool (e.g. `best_price(q: "wireless earbuds")`)
2. The server makes an HTTP request to the Crush Pricing API
3. The API returns `402 Payment Required` with x402 payment details
4. The server automatically signs a USDC payment using your wallet
5. The request is retried with the payment header
6. You get the pricing data back

All payment handling is automatic and transparent via the [x402 protocol](https://x402.org).

## Direct API Access

If you prefer to call the API directly without the MCP server:

```bash
# OpenAPI spec
curl https://api.crushrewards.dev/openapi.json

# Example request (returns 402 for payment)
curl -H "X-API-Key: YOUR_KEY" \
  https://api.crushrewards.dev/v1/shopper/best-price?q=wireless+earbuds
```

The API also accepts payments via **MPP** (USDC.e on Tempo) and **x402 on Solana**.

## License

MIT
