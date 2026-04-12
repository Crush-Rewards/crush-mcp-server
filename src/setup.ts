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

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

export async function runSetup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("  Crush Pricing Intelligence API — Setup");
  console.log("  ───────────────────────────────────────");
  console.log("");

  // Check for existing wallet
  let existing: WalletFile | null = null;
  if (existsSync(WALLET_FILE)) {
    existing = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
    console.log("  Existing wallet found at ~/.crush/wallet.json");
    if (existing!.evmAddress) console.log("    Base/Tempo (EVM): " + existing!.evmAddress);
    if (existing!.solanaAddress) console.log("    Solana:           " + existing!.solanaAddress);
    console.log("");
    const reuse = await prompt(rl, "  Use existing wallet? (Y/n): ");
    if (reuse.toLowerCase() === "n") {
      existing = null;
    }
  }

  let walletConfig: WalletFile;

  if (existing) {
    walletConfig = existing;
  } else {
    // Network selection
    console.log("");
    console.log("  Which networks do you want to set up?");
    console.log("");
    console.log("    1. Base (USDC) — recommended, lowest fees");
    console.log("    2. Solana (USDC)");
    console.log("    3. Both Base and Solana");
    console.log("");

    const choice = await prompt(rl, "  Choose (1/2/3) [1]: ");
    const selected = choice === "2" ? "solana" : choice === "3" ? "both" : "base";

    walletConfig = { createdAt: new Date().toISOString() };

    // Generate EVM wallet (Base + Tempo share the same address)
    if (selected === "base" || selected === "both") {
      const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      walletConfig.evmPrivateKey = privateKey;
      walletConfig.evmAddress = account.address;
    }

    // Generate Solana wallet
    if (selected === "solana" || selected === "both") {
      const { base58 } = await import("@scure/base");
      const ed25519Key = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
      const privRaw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", ed25519Key.privateKey));
      const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ed25519Key.publicKey));
      const seed = privRaw.slice(privRaw.length - 32);
      const keypairBytes = new Uint8Array(64);
      keypairBytes.set(seed, 0);
      keypairBytes.set(pubRaw, 32);

      walletConfig.solanaPrivateKey = base58.encode(keypairBytes);
      walletConfig.solanaAddress = base58.encode(pubRaw);
    }

    // Save wallet
    mkdirSync(WALLET_DIR, { recursive: true });
    writeFileSync(WALLET_FILE, JSON.stringify(walletConfig, null, 2), { mode: 0o600 });
  }

  // Show wallet addresses and funding instructions
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

  // API key
  console.log("");
  let apiKey = await prompt(rl, "  Enter your API key (or press Enter to skip): ");

  // Configure Claude Code
  console.log("");
  const configureClaude = await prompt(rl, "  Auto-configure Claude Code? (Y/n): ");

  if (configureClaude.toLowerCase() !== "n") {
    const envArgs: string[] = [];

    if (walletConfig.evmPrivateKey) {
      envArgs.push("-e", "CRUSH_EVM_PRIVATE_KEY=" + walletConfig.evmPrivateKey);
    }
    if (walletConfig.solanaPrivateKey) {
      envArgs.push("-e", "CRUSH_SOLANA_PRIVATE_KEY=" + walletConfig.solanaPrivateKey);
    }
    if (apiKey) {
      envArgs.push("-e", "CRUSH_API_KEY=" + apiKey);
    }

    const cmd = [
      "claude", "mcp", "add",
      "-s", "user",
      ...envArgs,
      "crush-pricing",
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
    if (apiKey) config["CRUSH_API_KEY"] = apiKey;
    console.log('    "crush-pricing": {');
    console.log('      "command": "npx",');
    console.log('      "args": ["-y", "@crush-rewards/mcp-server"],');
    console.log('      "env": ' + JSON.stringify(config, null, 8).split("\n").map((l, i) => i === 0 ? l : "      " + l).join("\n"));
    console.log("    }");
  }

  console.log("");
  console.log("  Done! Fund your wallet and start querying.");
  console.log("");

  rl.close();
}
