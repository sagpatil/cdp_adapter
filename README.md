# CDP Stellar Adapter

A TypeScript adapter that exposes CDP-style embedded wallet APIs while handling all Stellar-specific logic behind the scenes.

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

// Send a payment
const tx = await adapter.sendTransaction({
  from: wallet.address,
  to: 'GDESTINATION...',
  amount: '10',
  asset: 'native',
});

// Fee bump a pending transaction (sponsored by Stellar Foundation or custom sponsor)
const bumpedTx = await adapter.feeBumpTransaction(
  tx.hash,
  '20000', // max fee in stroops
  sponsorSecretKey // optional: if not provided, requires Stellar Foundation sponsor configuration
);
```

### As a REST Server

```bash
npm run start:server
```

The server exposes CDP-compatible endpoints:

- `POST /wallets` - Create a new wallet
- `GET /wallets/:address` - Get wallet details
- `POST /wallets/import` - Import an existing wallet
- `POST /transactions` - Build and submit a transaction
- `GET /transactions/:hash` - Get transaction status
- `POST /transactions/:hash/fee-bump` - Bump the fee of a pending transaction
- `GET /sponsor` - Get Stellar Foundation sponsor address for current network

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
