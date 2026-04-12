# Crush Pricing Intelligence MCP Server

MCP server that gives AI agents access to real-time competitive pricing data across Amazon, Walmart, Costco, and more. Pay-per-query via [x402](https://x402.org) micropayments.

## Quick Start

### Easy Setup (recommended)

```bash
npx @crush-rewards/mcp-server --setup
```

This will:
1. Ask which networks you want (Base, Solana, or both)
2. Generate a wallet for each selected network
3. Show your wallet address for funding
4. Auto-configure Claude Code

Fund your wallet with USDC and you're ready to query.

### Manual Setup

If you already have wallets, add directly to Claude Code:

```bash
claude mcp add -s user \
  -e CRUSH_EVM_PRIVATE_KEY=0x... \
  -e CRUSH_SOLANA_PRIVATE_KEY=... \
  -e CRUSH_API_KEY=... \
  crush-pricing -- npx -y @crush-rewards/mcp-server
```

Or add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "crush-pricing": {
      "command": "npx",
      "args": ["-y", "@crush-rewards/mcp-server"],
      "env": {
        "CRUSH_EVM_PRIVATE_KEY": "0x_YOUR_BASE_WALLET_PRIVATE_KEY",
        "CRUSH_SOLANA_PRIVATE_KEY": "YOUR_SOLANA_PRIVATE_KEY_BASE58",
        "CRUSH_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

### Requirements

- **USDC** on Base and/or Solana — for micropayments ($0.005-$0.02 per query)
- **API key** — request at [crushrewards.dev](https://crushrewards.dev)

## Supported Payment Methods

| Protocol | Network | Token | How |
|----------|---------|-------|-----|
| x402 | **Base** | USDC | Automatic via MCP server (EVM wallet) |
| x402 | **Solana** | USDC | Automatic via MCP server (Solana wallet) |
| MPP | **Tempo** | USDC.e | Direct API access (see below) |

The MCP server handles x402 payments on Base and Solana automatically. For MPP on Tempo, use the API directly with an MPP-compatible client like [Sponge](https://paysponge.com).

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

### Utility

| Tool | Description |
|------|-------------|
| `wallet_info` | Show your wallet address and funding instructions |

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
| `CRUSH_EVM_PRIVATE_KEY` | One of EVM or Solana | 0x-prefixed private key for a Base wallet with USDC |
| `CRUSH_SOLANA_PRIVATE_KEY` | One of EVM or Solana | Base58-encoded Solana private key with USDC |
| `CRUSH_WALLET_PRIVATE_KEY` | — | Alias for `CRUSH_EVM_PRIVATE_KEY` |
| `CRUSH_API_KEY` | Yes | API key for the Crush Pricing API |
| `CRUSH_API_BASE` | No | API base URL (defaults to `https://api.crushrewards.dev`) |

If no wallet keys are provided, a Base wallet is auto-generated and saved to `~/.crush/wallet.json`.

## How It Works

1. You call an MCP tool (e.g. `best_price(q: "wireless earbuds")`)
2. The server makes an HTTP request to the Crush Pricing API
3. The API returns `402 Payment Required` with x402 payment details
4. The server automatically signs a USDC payment using your wallet (Base or Solana)
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

The API accepts payments via:
- **x402** — USDC on Base and Solana
- **MPP** — USDC.e on Tempo

## License

MIT
