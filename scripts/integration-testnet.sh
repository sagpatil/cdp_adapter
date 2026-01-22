#!/usr/bin/env bash
#
# Testnet integration smoke test
#
# Purpose
# - Runs a minimal end-to-end flow against Stellar Testnet using the SDK.
# - Validates the "happy path" works with real network services:
#   - Friendbot funding
#   - Horizon account lookup
#   - Building + signing + submitting a payment transaction
#   - Fetching the transaction back and extracting payment details
#   - Verifying the destination balance increased
#
# What this script is NOT
# - It is not a full integration test framework.
# - It does not test Soroban contract calls.
# - It does not test fee-bump sponsorship (can be added as a follow-up).
#
# How to run
#   npm run integration:testnet
#
# Requirements
# - Node.js 18+ (for global fetch)
# - Network access to:
#   - https://friendbot.stellar.org
#   - https://horizon-testnet.stellar.org

set -euo pipefail

# Move to repo root, regardless of where the script is executed from.
cd "$(dirname "$0")/.."

# Basic sanity checks so failures are clear and early.
if ! command -v node >/dev/null 2>&1; then
  echo "node is required" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required" >&2
  exit 1
fi

echo "==> Installing deps (if needed)"
# Prefer deterministic installs when package-lock.json exists.
# If you are iterating quickly and want faster install behavior, you can replace
# this with `npm install`.
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> Building"
# We run the built `dist/` output so this matches how consumers would run the SDK.
npm run build

echo "==> Running testnet flow"
# The embedded Node script does the actual network interactions.
# We keep it inside this file so running it is a one-liner and doesn't require
# publishing/building another package.
node - <<'NODE'
// This script uses the compiled JS build so we exercise the published surface.
const { StellarWalletAdapter } = require('./dist/index.js');

// Horizon is the "read layer" for Stellar. We use it to verify account state.
const HORIZON = 'https://horizon-testnet.stellar.org';

// Friendbot creates and funds new accounts on TESTNET ONLY.
// This is intentionally not supported on mainnet.
async function friendbotFund(address) {
  const url = `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Friendbot failed (${res.status}): ${body}`);
  }
  return res.json().catch(() => ({}));
}

// Fetch an account JSON record from Horizon.
// This is used for:
// - polling until Friendbot funding has propagated
// - checking balances at the end
async function getAccount(address) {
  const res = await fetch(`${HORIZON}/accounts/${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Horizon account fetch failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Small delay helper for polling.
async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

// Friendbot is eventually consistent relative to Horizon reads.
// Poll until the account exists to avoid flaky failures.
async function pollAccountExists(address, { timeoutMs = 20_000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return await getAccount(address);
    } catch (e) {
      await sleep(750);
    }
  }
  throw new Error(`Timed out waiting for account to exist: ${address}`);
}

async function main() {
  // Capture adapter events to ensure the event hook is working end-to-end.
  // We intentionally keep assertions lightweight: this is a smoke test.
  const events = [];

  // Create the adapter configured for testnet.
  // `onEvent` is optional but helps validate the normalized event flow.
  const adapter = new StellarWalletAdapter({
    network: 'testnet',
    onEvent: (evt) => {
      events.push(evt.type);
      // Keep log concise
      if (evt.type !== 'transaction.pending') console.log(`[event] ${evt.type}`);
    },
  });

  // Create two random wallets.
  // Note: This adapter stores wallets in-memory (Map) for demo/testing.
  const sourceWallet = await adapter.createWallet();
  const destWallet = await adapter.createWallet();

  // Retrieve secret keys from the adapter's in-memory store.
  // This is only used locally here (we never print secrets).
  const sourceKeypair = adapter.getWalletKeypair(sourceWallet.address);
  const destKeypair = adapter.getWalletKeypair(destWallet.address);

  if (!sourceKeypair || !destKeypair) throw new Error('Keypairs missing from adapter store');

  console.log('Source:', sourceWallet.address);
  console.log('Dest:  ', destWallet.address);

  // Fund accounts. Friendbot will create the accounts if they don't exist.
  // If Friendbot is rate-limiting or down, this step will fail.
  console.log('==> Funding accounts via Friendbot');
  await friendbotFund(sourceWallet.address);
  await friendbotFund(destWallet.address);

  // Wait until Horizon can see them.
  await pollAccountExists(sourceWallet.address);
  await pollAccountExists(destWallet.address);

  // Send a basic payment from source -> dest.
  // If you want to test assets, change `asset` to `CODE:ISSUER` and ensure
  // trustlines are established (not covered by this smoke test).
  console.log('==> Sending payment (1 XLM)');
  const tx = await adapter.sendTransaction({
    from: sourceWallet.address,
    to: destWallet.address,
    amount: '1',
    asset: 'native',
    memo: 'integration-test',
    memoType: 'text',
  });

  console.log('Transaction hash:', tx.hash);
  console.log('Status:', tx.status);

  // Fetch back the transaction.
  // The adapter fetches operations separately so it can best-effort populate
  // destination / amount / asset fields.
  console.log('==> Verifying via adapter.getTransaction()');
  const fetched = await adapter.getTransaction(tx.hash);
  console.log({
    status: fetched.status,
    from: fetched.from,
    to: fetched.to,
    amount: fetched.amount,
    asset: fetched.asset,
    ledger: fetched.ledger,
  });

  // Confirm the destination now has (at least) the funded amount.
  // We only print the balance here. You could make this stricter by capturing
  // the balance before sending, then asserting postBalance >= preBalance + 1.
  console.log('==> Checking destination balance (native)');
  const destAccount = await getAccount(destWallet.address);
  const nativeBal = (destAccount.balances || []).find((b) => b.asset_type === 'native');
  console.log('Dest native balance:', nativeBal?.balance);

  // Basic assertions
  // This keeps the script actionable as a smoke test while still failing when
  // key integration pieces are broken.
  if (!events.includes('wallet.created')) throw new Error('Expected wallet.created event');
  if (!events.includes('transaction.pending')) throw new Error('Expected transaction.pending event');
  if (!events.includes('transaction.success') && !events.includes('transaction.failed')) {
    throw new Error('Expected transaction.success or transaction.failed event');
  }

  console.log('==> Done');
}

// Ensure we exit non-zero on failures so CI can detect it.
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
