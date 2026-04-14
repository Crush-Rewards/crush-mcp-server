import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { loadOrCreateWallet } from "./lib/wallet.js";

async function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

export function printHelp() {
  console.log(`
  Crush Pricing Intelligence — MCP Server

  Usage:
    npx @crush-rewards/mcp-server           Start the MCP server
    npx @crush-rewards/mcp-server --setup    Interactive wallet + Claude Code setup
    npx @crush-rewards/mcp-server --help     Show this help

  Available Tools:

    Shopper (0.005 USDC/query)
      best_price          Find the cheapest price across retailers
      price_history       Price trends over time
      deal_finder         Current deals in a category
      price_drop_alert    Recent price drops

    Marketing (0.01 USDC/query)
      competitive_landscape   Competitive pricing overview
      brand_tracker           Brand pricing and positioning
      promo_intelligence      Promotional activity intelligence
      share_of_shelf          Brand share of shelf analysis
      price_positioning       Price positioning vs competitors

    Analyst (0.02 USDC/query)
      inflation_tracker       Category price inflation trends
      shrinkflation_detector  Detect shrinkflation patterns
      price_dispersion        Price variance across retailers
      retailer_index          Pricing index for a retailer
      category_summary        Comprehensive category summary

    Utility
      wallet_info             Show wallet addresses (optionally include private keys)

  Payment: USDC on Base, USDC on Solana, or USDC.e on Tempo.
           Fund any chain — the server auto-selects whichever has balance.
  Docs: https://crushrewards.dev
`);
}

function printPrivateKeys(evmKey: string, solanaKey: string) {
  console.log("");
  console.log("  ─────────────────────────────────────────────────────────────");
  console.log("  ⚠️  PRIVATE KEYS — save to a password manager, never share");
  console.log("  ─────────────────────────────────────────────────────────────");
  console.log("");
  console.log("    EVM key (Base/Tempo): " + evmKey);
  console.log("    Solana key (base58):  " + solanaKey);
  console.log("");
  console.log("  Import EVM key into MetaMask/Rabby, Solana key into Phantom/Solflare");
  console.log("  if you want to fund or manage your balance from an external wallet.");
  console.log("");
}

export async function runSetup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("  Crush Pricing Intelligence — Setup");
  console.log("  ───────────────────────────────────");
  console.log("");

  const { wallet, isNew } = await loadOrCreateWallet();

  console.log(isNew ? "  Generated new multi-chain wallet:" : "  Existing wallet at ~/.crush/wallet.json:");
  console.log("");
  console.log("    Base / Tempo (EVM): " + wallet.evmAddress);
  console.log("    Solana:             " + wallet.solanaAddress);
  console.log("");
  console.log("  Fund any of these — the server picks the one with balance per query.");

  // Only show keys automatically on fresh generation. For existing wallets we
  // prompt, so keys don't leak to terminal scrollback when users re-run setup
  // just to reconfigure Claude Code.
  if (isNew) {
    printPrivateKeys(wallet.evmPrivateKey, wallet.solanaPrivateKey);
  } else {
    console.log("");
    const showKeys = await ask(rl, "  Show private keys? (y/N): ");
    if (showKeys.toLowerCase() === "y") {
      printPrivateKeys(wallet.evmPrivateKey, wallet.solanaPrivateKey);
    }
  }

  await configureClaudeCode(rl);
  rl.close();
}

async function configureClaudeCode(rl: ReturnType<typeof createInterface>) {
  const configureClaude = await ask(rl, "  Auto-configure Claude Code? (Y/n): ");

  // No env args needed — wallet.json is the source of truth.
  // We keep the command this simple so rotating keys doesn't require re-running `claude mcp add`.
  const claudeArgs = [
    "mcp", "add",
    "-s", "user",
    "crush-pricing",
    "--",
    "npx", "-y", "@crush-rewards/mcp-server",
  ];
  const cmdString = "claude " + claudeArgs.join(" ");

  if (configureClaude.toLowerCase() !== "n") {
    // Disclose which `claude` binary we're about to run — defends against PATH hijack
    // where a malicious ~/bin/claude or node_modules/.bin/claude shadows the real CLI.
    const which = spawnSync(process.platform === "win32" ? "where" : "which", ["claude"], { encoding: "utf8" });
    const resolvedPath = which.status === 0 ? which.stdout.trim().split("\n")[0] : "(not found on PATH)";
    console.log("");
    console.log("  Running: " + resolvedPath);
    console.log("  Args:    " + claudeArgs.join(" "));
    const confirm = await ask(rl, "  Proceed? (Y/n): ");
    if (confirm.toLowerCase() === "n") {
      console.log("");
      console.log("  Skipped. Run manually when ready:");
      console.log("");
      console.log("    " + cmdString);
      return;
    }

    // spawnSync with argv array — no shell interpolation, no injection risk.
    const result = spawnSync("claude", claudeArgs, { stdio: "inherit" });
    if (result.status === 0) {
      console.log("");
      console.log("  Claude Code configured! Open a new session to use the pricing tools.");
    } else {
      console.log("");
      console.log("  Could not auto-configure Claude Code.");
      console.log("  Run this manually:");
      console.log("");
      console.log("    " + cmdString);
    }
  } else {
    console.log("");
    console.log("  Add this to ~/.claude/settings.json under mcpServers:");
    console.log("");
    console.log('    "crush-pricing": {');
    console.log('      "command": "npx",');
    console.log('      "args": ["-y", "@crush-rewards/mcp-server"]');
    console.log("    }");
    console.log("");
    console.log("  (Wallet is read from ~/.crush/wallet.json — no env vars needed.)");
  }

  console.log("");
  console.log("  Done! Fund any address above and start querying.");
  console.log("");
}
