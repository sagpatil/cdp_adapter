// EventNormalizer - Converts Stellar ledger effects to CDP event format
import type { CDPEvent, CDPEventType, CDPTransaction, CDPWallet } from '../types/cdp';

export class EventNormalizer {
  /**
   * Create a transaction pending event
   */
  createTransactionPendingEvent(transaction: CDPTransaction): CDPEvent {
    return {
      type: 'transaction.pending',
      timestamp: new Date().toISOString(),
      data: { ...transaction, status: 'pending' },
    };
  }

  /**
   * Create a transaction success event
   */
  createTransactionSuccessEvent(transaction: CDPTransaction): CDPEvent {
    return {
      type: 'transaction.success',
      timestamp: new Date().toISOString(),
      data: { ...transaction, status: 'success' },
    };
  }

  /**
   * Create a transaction failed event
   */
  createTransactionFailedEvent(transaction: CDPTransaction): CDPEvent {
    return {
      type: 'transaction.failed',
      timestamp: new Date().toISOString(),
      data: { ...transaction, status: 'failed' },
    };
  }

  /**
   * Create a wallet created event
   */
  createWalletCreatedEvent(wallet: CDPWallet): CDPEvent {
    return {
      type: 'wallet.created',
      timestamp: new Date().toISOString(),
      data: wallet,
    };
  }

  /**
   * Normalize Stellar transaction result to CDP event
   */
  normalizeTransactionResult(
    transaction: CDPTransaction,
    successful: boolean
  ): CDPEvent {
    return successful
      ? this.createTransactionSuccessEvent(transaction)
      : this.createTransactionFailedEvent(transaction);
  }
}
