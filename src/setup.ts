import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const WALLET_DIR = join(homedir(), ".crush");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

interface WalletFile {
  evmPrivateKey?: string;
  evmAddress?: string;
  solanaPrivateKey?: string;
  solanaAddress?: string;
  createdAt: string;
}

async function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function generateEvmWallet(): Promise<{ privateKey: string; address: string }> {
  const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

async function generateSolanaWallet(): Promise<{ privateKey: string; address: string }> {
  const { base58 } = await import("@scure/base");
  const ed25519Key = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const privRaw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", ed25519Key.privateKey));
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ed25519Key.publicKey));
  const seed = privRaw.slice(privRaw.length - 32);
  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(seed, 0);
  keypairBytes.set(pubRaw, 32);
  return { privateKey: base58.encode(keypairBytes), address: base58.encode(pubRaw) };
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
      wallet_info             Show wallet address and funding info

  Payment: USDC on Base, USDC on Solana, or USDC.e on Tempo
  Docs: https://crushrewards.dev
`);
}

export async function runSetup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("  Crush Pricing Intelligence — Setup");
  console.log("  ───────────────────────────────────");
  console.log("");

  // Check for existing wallet
  let existing: WalletFile | null = null;
  if (existsSync(WALLET_FILE)) {
    existing = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
    console.log("  Existing wallet found at ~/.crush/wallet.json");
    if (existing!.evmAddress) console.log("    Base/Tempo (EVM): " + existing!.evmAddress);
    if (existing!.solanaAddress) console.log("    Solana:           " + existing!.solanaAddress);
    console.log("");
    const reuse = await ask(rl, "  Use existing wallet? (Y/n): ");
    if (reuse.toLowerCase() !== "n") {
      await configureClaudeCode(rl, existing!);
      rl.close();
      return;
    }
    existing = null;
  }

  // Q1: Create or import?
  console.log("  How would you like to set up your wallet?");
  console.log("");
  console.log("    1. Create a new wallet (recommended)");
  console.log("    2. Import an existing wallet");
  console.log("");

  const method = await ask(rl, "  Choose (1/2) [1]: ");

  let walletConfig: WalletFile = { createdAt: new Date().toISOString() };

  if (method === "2") {
    // Import flow
    console.log("");
    console.log("  Which network is your wallet on?");
    console.log("");
    console.log("    1. Base (USDC)");
    console.log("    2. Solana (USDC)");
    console.log("    3. Tempo (USDC.e)");
    console.log("");

    const network = await ask(rl, "  Choose (1/2/3) [1]: ");
    console.log("");

    if (network === "2") {
      const key = await ask(rl, "  Enter your Solana private key (base58): ");
      walletConfig.solanaPrivateKey = key;
      try {
        const { base58 } = await import("@scure/base");
        const bytes = base58.decode(key);
        walletConfig.solanaAddress = base58.encode(bytes.slice(32));
      } catch {
        console.log("  (Could not derive address — key will still be used)");
      }
    } else {
      // Base and Tempo both use EVM keys
      const key = await ask(rl, "  Enter your EVM private key (0x-prefixed): ");
      walletConfig.evmPrivateKey = key;
      try {
        const { privateKeyToAccount } = await import("viem/accounts");
        const account = privateKeyToAccount(key as `0x${string}`);
        walletConfig.evmAddress = account.address;
      } catch {
        console.log("  (Could not derive address — key will still be used)");
      }
    }
  } else {
    // Create new wallet flow
    console.log("");
    console.log("  Which network?");
    console.log("");
    console.log("    1. Base (USDC) — lowest fees");
    console.log("    2. Solana (USDC)");
    console.log("    3. Tempo (USDC.e)");
    console.log("    4. Choose for me");
    console.log("");

    const network = await ask(rl, "  Choose (1/2/3/4) [4]: ");

    if (network === "2") {
      const sol = await generateSolanaWallet();
      walletConfig.solanaPrivateKey = sol.privateKey;
      walletConfig.solanaAddress = sol.address;
    } else {
      // 1, 3, 4 (default) all generate an EVM wallet
      const evm = await generateEvmWallet();
      walletConfig.evmPrivateKey = evm.privateKey;
      walletConfig.evmAddress = evm.address;
    }
  }

  // Save wallet
  mkdirSync(WALLET_DIR, { recursive: true });
  writeFileSync(WALLET_FILE, JSON.stringify(walletConfig, null, 2), { mode: 0o600 });

  // Show wallet info
  console.log("");
  console.log("  Wallet ready:");
  console.log("  ─────────────");

  if (walletConfig.evmAddress) {
    console.log("");
    console.log("  Base / Tempo (EVM):");
    console.log("    Address: " + walletConfig.evmAddress);
    console.log("    Send USDC on Base or USDC.e on Tempo to this address.");
  }

  if (walletConfig.solanaAddress) {
    console.log("");
    console.log("  Solana:");
    console.log("    Address: " + walletConfig.solanaAddress);
    console.log("    Send USDC on Solana to this address.");
  }

  console.log("");
  console.log("  Each query costs 0.005-0.02 USDC. Even 1 USDC gets you 50-200 queries.");
  console.log("  Saved to: ~/.crush/wallet.json");

  await configureClaudeCode(rl, walletConfig);
  rl.close();
}

async function configureClaudeCode(rl: ReturnType<typeof createInterface>, walletConfig: WalletFile) {
  // Configure Claude Code
  console.log("");
  const configureClaude = await ask(rl, "  Auto-configure Claude Code? (Y/n): ");

  if (configureClaude.toLowerCase() !== "n") {
    const envArgs: string[] = [];

    if (walletConfig.evmPrivateKey) {
      envArgs.push("-e", "CRUSH_EVM_PRIVATE_KEY=" + walletConfig.evmPrivateKey);
    }
    if (walletConfig.solanaPrivateKey) {
      envArgs.push("-e", "CRUSH_SOLANA_PRIVATE_KEY=" + walletConfig.solanaPrivateKey);
    }
    const cmd = [
      "claude", "mcp", "add",
      "-s", "user",
      "crush-pricing",
      ...envArgs,
      "--",
      "npx", "-y", "@crush-rewards/mcp-server",
    ].map(a => a.includes(" ") ? `"${a}"` : a).join(" ");

    try {
      execSync(cmd, { stdio: "inherit" });
      console.log("");
      console.log("  Claude Code configured! Open a new session to use the pricing tools.");
    } catch {
      console.log("");
      console.log("  Could not auto-configure Claude Code.");
      console.log("  Run this manually:");
      console.log("");
      console.log("    " + cmd);
    }
  } else {
    // Show manual instructions
    console.log("");
    console.log("  Add this to ~/.claude/settings.json under mcpServers:");
    console.log("");
    const config: Record<string, string> = {};
    if (walletConfig.evmPrivateKey) config["CRUSH_EVM_PRIVATE_KEY"] = walletConfig.evmPrivateKey;
    if (walletConfig.solanaPrivateKey) config["CRUSH_SOLANA_PRIVATE_KEY"] = walletConfig.solanaPrivateKey;
    console.log('    "crush-pricing": {');
    console.log('      "command": "npx",');
    console.log('      "args": ["-y", "@crush-rewards/mcp-server"],');
    console.log('      "env": ' + JSON.stringify(config, null, 8).split("\n").map((l, i) => i === 0 ? l : "      " + l).join("\n"));
    console.log("    }");
  }

  console.log("");
  console.log("  Done! Fund your wallet and start querying.");
  console.log("");
}
