# CDP Stellar Adapter Architecture

This document provides an overview of the system architecture for the CDP Stellar Adapter.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CDP STELLAR ADAPTER ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Application   │
                              │  (SDK Consumer) │
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
   ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────┐
   │   SDK Import     │    │   REST Server     │    │    Types         │
   │   (index.ts)     │    │  (server/index.ts)│    │  (types/*.ts)    │
   └────────┬─────────┘    └─────────┬─────────┘    └──────────────────┘
            │                        │                        │
            │  Exports               │  Uses                  │ CDPWallet
            │                        │                        │ CDPTransaction
            ▼                        ▼                        │ CDPEvent
┌───────────────────────────────────────────────────────────────────────────────┐
│                         ADAPTER CORE LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    StellarWalletAdapter                                  │  │
│  │                 (adapter/StellarWalletAdapter.ts)                        │  │
│  │                                                                          │  │
│  │  • createWallet()      • sendTransaction()    • feeBumpTransaction()    │  │
│  │  • getWallet()         • getTransaction()     • importWallet()          │  │
│  │  • walletStore (Map)   • getStellarFoundationSponsor()                  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                     │              │              │              │             │
│        ┌───────────┴──────────┐   │   ┌─────────┴──────────┐   │             │
│        ▼                      ▼   │   ▼                    ▼   │             │
│  ┌───────────────┐  ┌─────────────┴───────┐  ┌──────────────────────┐        │
│  │    Signer     │  │ TransactionBuilder  │  │    FeeEstimator      │        │
│  │ (Signer.ts)   │  │(TransactionBuilder.ts)│  │  (FeeEstimator.ts)  │        │
│  │               │  │                      │  │                     │        │
│  │• generateKey  │  │• buildPaymentTx()   │  │• estimateFee()      │        │
│  │• signTx()     │  │• buildFeeBumpTx()   │  │• getBaseFee()       │        │
│  │• signFeeBump()│  │• parseAsset()       │  │                     │        │
│  │• getPublicKey │  │• parseMemo()        │  │                     │        │
│  └───────────────┘  └─────────────────────┘  └──────────────────────┘        │
│                                                         │                     │
│  ┌──────────────────────────────────────────────────────┴────────────────┐   │
│  │                       EventNormalizer                                  │   │
│  │                    (events/EventNormalizer.ts)                         │   │
│  │  • createTransactionPendingEvent()  • normalizeTransactionResult()    │   │
│  │  • createTransactionSuccessEvent()  • createWalletCreatedEvent()      │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Uses
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              RPC LAYER                                         │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │         StellarRpcClient            │  │      SorobanRpcClient           │ │
│  │      (rpc/StellarRpcClient.ts)      │  │   (rpc/SorobanRpcClient.ts)     │ │
│  │                                     │  │                                 │ │
│  │  • loadAccount()                    │  │  • invokeContract() [TODO]      │ │
│  │  • submitTransaction()              │  │  • getContractData() [TODO]     │ │
│  │  • submitFeeBumpTransaction()       │  │  • simulateTransaction() [TODO] │ │
│  │  • getTransaction()                 │  │                                 │ │
│  │  • getFeeStats()                    │  │                                 │ │
│  │  • accountExists()                  │  │                                 │ │
│  │  • getLedgerNumber()                │  │                                 │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTP/RPC
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                          STELLAR NETWORK                                       │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │           Horizon API               │  │        Soroban RPC              │ │
│  │  horizon.stellar.org (mainnet)      │  │   soroban-rpc.stellar.org       │ │
│  │  horizon-testnet.stellar.org        │  │   soroban-testnet.stellar.org   │ │
│  │  horizon-futurenet.stellar.org      │  │   rpc-futurenet.stellar.org     │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/wallets` | Create new wallet |
| GET | `/wallets/:address` | Get wallet details |
| POST | `/wallets/import` | Import wallet from secret key |
| POST | `/transactions` | Build & submit transaction |
| GET | `/transactions/:hash` | Get transaction status |
| POST | `/transactions/:hash/fee-bump` | Bump fee of pending transaction |
| GET | `/sponsor` | Get Foundation sponsor address |
| GET | `/health` | Health check |

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **StellarWalletAdapter** | `adapter/StellarWalletAdapter.ts` | Main orchestrator - coordinates all components |
| **Signer** | `adapter/Signer.ts` | Ed25519 keypair generation & transaction signing |
| **TransactionBuilder** | `adapter/TransactionBuilder.ts` | Builds payment & fee-bump transactions (XDR) |
| **FeeEstimator** | `adapter/FeeEstimator.ts` | Queries network for optimal fees |
| **StellarRpcClient** | `rpc/StellarRpcClient.ts` | Horizon API communication |
| **SorobanRpcClient** | `rpc/SorobanRpcClient.ts` | Smart contract RPC (placeholder) |
| **EventNormalizer** | `events/EventNormalizer.ts` | Converts Stellar events → CDP format |
| **REST Server** | `server/index.ts` | Express API exposing CDP-compatible endpoints |

## Data Flow

### 1. Create Wallet

```
Client → StellarWalletAdapter.createWallet()
       → Signer.generateKeypair()
       → Store in walletStore Map
       → Return CDPWallet
```

### 2. Send Transaction

```
Client → StellarWalletAdapter.sendTransaction(request)
       → Validate with Zod schema
       → StellarRpcClient.loadAccount() [Get sequence number]
       → FeeEstimator.estimateFee() → StellarRpcClient.getFeeStats()
       → TransactionBuilder.buildPaymentTransaction()
       → Signer.signTransaction()
       → StellarRpcClient.submitTransaction()
       → Return CDPTransaction
```

### 3. Fee Bump Transaction

```
Client → StellarWalletAdapter.feeBumpTransaction(hash, maxFee, sponsor)
       → StellarRpcClient.getTransaction() [Get original TX]
       → TransactionBuilder.buildFeeBumpTransaction()
       → Signer.signFeeBumpTransaction()
       → StellarRpcClient.submitFeeBumpTransaction()
       → Return CDPTransaction
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STELLAR_NETWORK` | Network to use | `testnet` |
| `HORIZON_URL` | Custom Horizon API URL | Network default |
| `SOROBAN_RPC_URL` | Custom Soroban RPC URL | Network default |
| `PORT` | Server port | `3000` |
| `EXPOSE_SECRET_KEYS` | Expose keys in responses | `false` |
| `STELLAR_FOUNDATION_SPONSOR_TESTNET` | Sponsor address for testnet | (empty) |
| `STELLAR_FOUNDATION_SPONSOR_MAINNET` | Sponsor address for mainnet | (empty) |
| `STELLAR_FOUNDATION_SPONSOR_FUTURENET` | Sponsor address for futurenet | (empty) |
| `STELLAR_FOUNDATION_SPONSOR_SECRET_KEY` | Sponsor secret used for fee bumps (generic) | (empty) |
| `STELLAR_FOUNDATION_SPONSOR_SECRET_TESTNET` | Sponsor secret used for fee bumps (testnet) | (empty) |
| `STELLAR_FOUNDATION_SPONSOR_SECRET_MAINNET` | Sponsor secret used for fee bumps (mainnet) | (empty) |
| `STELLAR_FOUNDATION_SPONSOR_SECRET_FUTURENET` | Sponsor secret used for fee bumps (futurenet) | (empty) |

## Directory Structure

```
cdp_adapter/
├── src/
│   ├── index.ts                 # Main entry point (exports)
│   ├── adapter/
│   │   ├── StellarWalletAdapter.ts  # Main orchestrator
│   │   ├── Signer.ts                # Keypair & signing
│   │   ├── TransactionBuilder.ts    # TX construction
│   │   └── FeeEstimator.ts          # Fee calculation
│   ├── rpc/
│   │   ├── StellarRpcClient.ts      # Horizon API client
│   │   └── SorobanRpcClient.ts      # Soroban RPC client
│   ├── events/
│   │   └── EventNormalizer.ts       # Event conversion
│   ├── server/
│   │   └── index.ts                 # REST API server
│   └── types/
│       ├── cdp.ts                   # CDP-compatible types
│       └── stellar.ts               # Stellar-specific types
├── tests/
│   ├── StellarWalletAdapter.test.ts
│   ├── Signer.test.ts
│   └── TransactionBuilder.test.ts
├── package.json
├── tsconfig.json
└── README.md
```
