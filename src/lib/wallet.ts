import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface WalletConfig {
  evmPrivateKey: string;
  evmAddress: string;
  createdAt: string;
}

const WALLET_DIR = join(homedir(), ".crush");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

export async function loadOrCreateWallet(): Promise<{ privateKey: string; address: string; isNew: boolean }> {
  if (existsSync(WALLET_FILE)) {
    const config: WalletConfig = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
    return { privateKey: config.evmPrivateKey, address: config.evmAddress, isNew: false };
  }

  const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const config: WalletConfig = {
    evmPrivateKey: privateKey,
    evmAddress: account.address,
    createdAt: new Date().toISOString(),
  };

  mkdirSync(WALLET_DIR, { recursive: true });
  writeFileSync(WALLET_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });

  return { privateKey, address: account.address, isNew: true };
}
