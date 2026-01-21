#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "node is required" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required" >&2
  exit 1
fi

echo "==> Installing deps (if needed)"
# Use npm ci when lockfile exists; otherwise fall back to npm install
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> Building"
npm run build

echo "==> Running testnet flow"
node - <<'NODE'
const { StellarWalletAdapter } = require('./dist/index.js');

const HORIZON = 'https://horizon-testnet.stellar.org';

async function friendbotFund(address) {
  const url = `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Friendbot failed (${res.status}): ${body}`);
  }
  return res.json().catch(() => ({}));
}

async function getAccount(address) {
  const res = await fetch(`${HORIZON}/accounts/${encodeURIComponent(address)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Horizon account fetch failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

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
  const events = [];
  const adapter = new StellarWalletAdapter({
    network: 'testnet',
    onEvent: (evt) => {
      events.push(evt.type);
      // Keep log concise
      if (evt.type !== 'transaction.pending') console.log(`[event] ${evt.type}`);
    },
  });

  const sourceWallet = await adapter.createWallet();
  const destWallet = await adapter.createWallet();

  const sourceKeypair = adapter.getWalletKeypair(sourceWallet.address);
  const destKeypair = adapter.getWalletKeypair(destWallet.address);

  if (!sourceKeypair || !destKeypair) throw new Error('Keypairs missing from adapter store');

  console.log('Source:', sourceWallet.address);
  console.log('Dest:  ', destWallet.address);

  console.log('==> Funding accounts via Friendbot');
  await friendbotFund(sourceWallet.address);
  await friendbotFund(destWallet.address);

  await pollAccountExists(sourceWallet.address);
  await pollAccountExists(destWallet.address);

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

  console.log('==> Checking destination balance (native)');
  const destAccount = await getAccount(destWallet.address);
  const nativeBal = (destAccount.balances || []).find((b) => b.asset_type === 'native');
  console.log('Dest native balance:', nativeBal?.balance);

  // Basic assertions
  if (!events.includes('wallet.created')) throw new Error('Expected wallet.created event');
  if (!events.includes('transaction.pending')) throw new Error('Expected transaction.pending event');
  if (!events.includes('transaction.success') && !events.includes('transaction.failed')) {
    throw new Error('Expected transaction.success or transaction.failed event');
  }

  console.log('==> Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
