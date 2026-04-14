import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface WalletConfig {
  createdAt: string;
  evmPrivateKey: string;
  evmAddress: string;
  solanaPrivateKey: string;
  solanaAddress: string;
}

const WALLET_DIR = join(homedir(), ".crush");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

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

/**
 * Refuse to follow symlinks on either the wallet directory or file — an attacker
 * with local filesystem access could otherwise redirect our writes.
 */
function assertNoSymlink(path: string): void {
  if (!existsSync(path)) return;
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(
      `Refusing to use ${path}: it is a symlink. Remove it (with care — it may point to a real wallet) ` +
      `and re-run. This check prevents an attacker from redirecting your private keys to a world-readable location.`,
    );
  }
}

function saveWallet(config: WalletConfig): void {
  assertNoSymlink(WALLET_DIR);
  mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });
  // mode on mkdirSync/writeFileSync only applies at creation; force-tighten
  // existing dir/file so a user who restored a backup with loose perms is safe.
  try { chmodSync(WALLET_DIR, 0o700); } catch { /* best-effort */ }

  assertNoSymlink(WALLET_FILE);
  writeFileSync(WALLET_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  try { chmodSync(WALLET_FILE, 0o600); } catch { /* best-effort */ }
}

function warnIfPermissive(): void {
  if (!existsSync(WALLET_FILE)) return;
  try {
    const mode = statSync(WALLET_FILE).mode;
    if (mode & 0o077) {
      console.error(
        `⚠️  ${WALLET_FILE} is readable by other users (mode ${(mode & 0o777).toString(8)}). ` +
        `Fix with: chmod 600 ${WALLET_FILE}`,
      );
    }
  } catch { /* best-effort */ }
}

/**
 * Loads the wallet from ~/.crush/wallet.json, or generates a new multi-chain
 * wallet if none exists. The wallet is always authoritative — no partial state.
 */
export async function loadOrCreateWallet(): Promise<{
  wallet: WalletConfig;
  isNew: boolean;
}> {
  warnIfPermissive();

  if (existsSync(WALLET_FILE)) {
    const wallet: WalletConfig = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
    return { wallet, isNew: false };
  }

  const [evm, solana] = await Promise.all([generateEvmWallet(), generateSolanaWallet()]);
  const wallet: WalletConfig = {
    createdAt: new Date().toISOString(),
    evmPrivateKey: evm.privateKey,
    evmAddress: evm.address,
    solanaPrivateKey: solana.privateKey,
    solanaAddress: solana.address,
  };
  saveWallet(wallet);
  return { wallet, isNew: true };
}
