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
```

### As a REST Server

```bash
npm run start:server
```

The server exposes CDP-compatible endpoints:

- `POST /wallets` - Create a new wallet
- `GET /wallets/:address` - Get wallet details
- `POST /transactions` - Build and submit a transaction
- `GET /transactions/:hash` - Get transaction status

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

## License

MIT
