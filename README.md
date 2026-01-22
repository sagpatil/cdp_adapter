# CDP Stellar Adapter

A TypeScript adapter that exposes CDP-style embedded wallet APIs while handling all Stellar-specific logic behind the scenes.

## TL;DR (Plain English)

This repo gives you a **CDP-shaped wallet API** for **Stellar**.

- Your app (or any “CDP embedded wallet”-style consumer) talks to this adapter using familiar wallet methods like `createWallet()` and `sendTransaction()`.
- The adapter does the Stellar-heavy lifting for you: generating keypairs, building XDR, signing, fee estimation, and submitting to Horizon/Soroban.

Important: calling `createWallet()` generates keys locally; the account only “exists on-chain” once it’s **funded** (on testnet, that’s usually via Friendbot).

### How requests flow

```
App / CDP-style caller
        |
        |  (CDP-like requests + responses)
        v
  CDP Stellar Adapter
        |
        |  (Stellar XDR + RPC calls)
        v
Stellar Network Services
 (Horizon + Soroban RPC)
```

### Create wallet (local) vs create account (on-chain)

```
createWallet()  -> generates keypair locally
fund account    -> creates the account on Stellar (testnet: Friendbot)
```

### Send payment flow

```
sendTransaction(request)
  -> validate request (zod)
  -> Horizon: loadAccount(from) [sequence]
  -> Horizon: feeStats() [fee]
  -> build XDR (payment op)
  -> sign XDR (secret key)
  -> Horizon: submitTransaction(XDR)
  -> return CDPTransaction (+ optional events)
```

## Features

- **CDP-Compatible API** - Familiar wallet interfaces for embedded wallet integration
- **Transaction Building** - Automatic Stellar transaction construction (XDR)
- **Signing** - Secure keypair management and ed25519 signatures
- **Fee Estimation** - Automatic fee calculation
- **RPC Submission** - Horizon & Soroban RPC transaction submission with retry logic
- **Event Normalization** - Stellar ledger effects converted to CDP event format

## Installation

```bash
npm install @stellar/cdp-adapter
```

## Quick Start

### As an SDK

```typescript
import { StellarWalletAdapter } from '@stellar/cdp-adapter';

const adapter = new StellarWalletAdapter({
  network: 'testnet',
});

// Create a wallet
const wallet = await adapter.createWallet();
console.log('Wallet address:', wallet.address);

// Send a payment
const tx = await adapter.sendTransaction({
  from: wallet.address,
  to: 'GDESTINATION...',
  amount: '10',
  asset: 'native',
});
console.log('Transaction hash:', tx.hash);

// Fee bump a pending transaction (sponsored by Stellar Foundation or custom sponsor)
// Note: sponsorSecretKey should be defined by the user or loaded from secure configuration
const sponsorSecretKey = process.env.SPONSOR_SECRET_KEY; // Load from environment
const bumpedTx = await adapter.feeBumpTransaction(
  tx.hash,
  '20000', // max fee in stroops
  sponsorSecretKey // optional: if not provided, requires Stellar Foundation sponsor configuration
);
```

### As a REST Server

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run start:server

# Or with custom configuration
STELLAR_NETWORK=testnet PORT=3000 npm run start:server
```

The server exposes CDP-compatible endpoints:

- `POST /wallets` - Create a new wallet
- `GET /wallets/:address` - Get wallet details
- `POST /wallets/import` - Import an existing wallet
- `POST /transactions` - Build and submit a transaction
- `GET /transactions/:hash` - Get transaction status
- `POST /transactions/:hash/fee-bump` - Bump the fee of a pending transaction
- `GET /sponsor` - Get Stellar Foundation sponsor address for current network

### Environment Variables

- `STELLAR_NETWORK` - Network to use (testnet, mainnet, futurenet) - default: testnet
- `HORIZON_URL` - Custom Horizon API URL (optional)
- `SOROBAN_RPC_URL` - Custom Soroban RPC URL (optional)
- `PORT` - Server port - default: 3000
- `EXPOSE_SECRET_KEYS` - Set to 'true' to expose secret keys in API responses (development only!)
- `NODE_ENV` - Set to 'development' to enable secret key exposure

Fee bump sponsorship (optional):

- `STELLAR_FOUNDATION_SPONSOR_SECRET_KEY` - Sponsor secret key used when `sponsorSecretKey` is not provided
- `STELLAR_FOUNDATION_SPONSOR_SECRET_TESTNET|MAINNET|FUTURENET` - Per-network override for the above
- `STELLAR_FOUNDATION_SPONSOR_TESTNET|MAINNET|FUTURENET` - Optional sponsor *address* to expose via `/sponsor` (if not set, address is derived from the sponsor secret key when available)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CDP API Layer                      │
│  (CDP-compatible interfaces: wallets, transactions)  │
├─────────────────────────────────────────────────────┤
│                  Adapter Core                        │
│  • Transaction Builder  • Signer  • Fee Estimator   │
│  • RPC Client          • Event Normalizer           │
├─────────────────────────────────────────────────────┤
│              Stellar SDK / Soroban RPC              │
└─────────────────────────────────────────────────────┘
```

## Configuration

```typescript
const adapter = new StellarWalletAdapter({
  network: 'mainnet' | 'testnet' | 'futurenet',
  horizonUrl: 'https://horizon.stellar.org', // optional
  sorobanRpcUrl: 'https://soroban-rpc.stellar.org', // optional
  onEvent: (event) => {
    // optional: receive normalized CDP-style events
  },
});
```

## Fee Bump Transactions

The adapter supports fee bump transactions, which allow you to increase the fee of a pending transaction to help it get included in a ledger faster. This is particularly useful when network fees increase or a transaction is stuck due to insufficient fees.

### Stellar Foundation Sponsorship

Fee bump transactions can be sponsored by the Stellar Foundation for both testnet and mainnet networks. The sponsor account pays the additional fee, allowing the original transaction to succeed without requiring the sender to have additional funds.

```typescript
// Fee bump with custom sponsor
const bumpedTx = await adapter.feeBumpTransaction(
  originalTxHash,
  '20000', // max fee in stroops
  sponsorSecretKey
);

// Get Stellar Foundation sponsor address for current network
const sponsorAddress = adapter.getStellarFoundationSponsor();
```

**Note:** For production use with Stellar Foundation sponsorship, you'll need to configure the sponsor's secret key via environment variable or secure key management system.

## License

MIT
