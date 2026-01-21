// CDP-compatible type definitions
// These types mirror the CDP embedded wallet API for seamless integration

import { z } from 'zod';

/** Supported networks */
export type Network = 'mainnet' | 'testnet' | 'futurenet';

/** Wallet representation (CDP-compatible) */
export interface CDPWallet {
  id: string;
  address: string;
  network: Network;
  createdAt: string;
}

/** Transaction request (CDP-compatible) */
export interface CDPTransactionRequest {
  from: string;
  to: string;
  amount: string;
  asset?: string; // 'native' for XLM, or 'CODE:ISSUER' format
  memo?: string;
  memoType?: 'text' | 'id' | 'hash' | 'return';
}

/** Transaction response (CDP-compatible) */
export interface CDPTransaction {
  id: string;
  hash: string;
  status: 'pending' | 'success' | 'failed';
  from: string;
  to: string;
  amount: string;
  asset: string;
  fee: string;
  createdAt: string;
  confirmedAt?: string;
  ledger?: number;
}

/** Event types (CDP-compatible) */
export type CDPEventType = 
  | 'transaction.pending'
  | 'transaction.success'
  | 'transaction.failed'
  | 'wallet.created';

/** Event payload (CDP-compatible) */
export interface CDPEvent {
  type: CDPEventType;
  timestamp: string;
  data: CDPTransaction | CDPWallet;
}

/** Adapter configuration */
export interface CDPAdapterConfig {
  network: Network;
  horizonUrl?: string;
  sorobanRpcUrl?: string;
}

// Zod schemas for runtime validation
export const TransactionRequestSchema = z.object({
  from: z.string().min(56).max(56),
  to: z.string().min(56).max(56),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  asset: z.string().optional(),
  memo: z.string().max(28).optional(),
  memoType: z.enum(['text', 'id', 'hash', 'return']).optional(),
});
