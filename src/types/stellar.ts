// Stellar-specific type definitions

import type { Network } from './cdp';

/** Stellar network configuration */
export interface StellarNetworkConfig {
  network: Network;
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
}

/** Stellar keypair info (internal) */
export interface StellarKeypair {
  publicKey: string;
  secretKey: string;
}

/** Stellar account info */
export interface StellarAccount {
  address: string;
  sequence: string;
  balances: StellarBalance[];
}

/** Stellar balance */
export interface StellarBalance {
  asset: string;
  balance: string;
}

/** Stellar transaction envelope (internal) */
export interface StellarTransactionEnvelope {
  xdr: string;
  hash: string;
  sourceAccount: string;
  fee: string;
  sequence: string;
  operations: StellarOperation[];
}

/** Stellar operation (simplified) */
export interface StellarOperation {
  type: string;
  destination?: string;
  amount?: string;
  asset?: string;
}

/** Stellar transaction result */
export interface StellarTransactionResult {
  hash: string;
  ledger: number;
  successful: boolean;
  resultXdr: string;
  envelopeXdr: string;
}

/** Network passphrase constants */
export const NETWORK_PASSPHRASES: Record<Network, string> = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
};

/** Default network URLs */
export const DEFAULT_HORIZON_URLS: Record<Network, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
};

export const DEFAULT_SOROBAN_RPC_URLS: Record<Network, string> = {
  mainnet: 'https://soroban-rpc.stellar.org',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
};
