// StellarRpcClient - Horizon API client for account management and transaction submission
import { Horizon, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';
import * as StellarSdk from '@stellar/stellar-sdk';
import type { StellarAccount, StellarBalance, StellarTransactionResult, StellarNetworkConfig } from '../types/stellar';

export class StellarRpcClient {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private maxRetries: number;

  constructor(
    config: StellarNetworkConfig,
    options?: {
      server?: StellarSdk.Horizon.Server;
      maxRetries?: number;
    }
  ) {
    this.server = options?.server ?? new StellarSdk.Horizon.Server(config.horizonUrl);
    this.networkPassphrase = config.networkPassphrase;
    this.maxRetries = Number.isFinite(options?.maxRetries as number) ? (options!.maxRetries as number) : 2;
  }

  private isRetryableError(error: any): boolean {
    const status = error?.response?.status;
    if (typeof status === 'number' && status >= 500) return true;

    const code = error?.code;
    if (typeof code === 'string' && ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) {
      return true;
    }

    return false;
  }

  private async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    const attempts = Math.max(0, Math.floor(this.maxRetries)) + 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt >= attempts || !this.isRetryableError(error)) {
          throw error;
        }

        // Tiny backoff to avoid hot-looping on transient network errors
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
    }

    // Unreachable, but keeps TS happy
    throw lastError;
  }

  /**
   * Load account information from Horizon
   */
  async loadAccount(address: string): Promise<StellarAccount> {
    try {
      const account = await this.server.loadAccount(address);
      
      const balances: StellarBalance[] = account.balances.map((bal: any) => ({
        asset: bal.asset_type === 'native' 
          ? 'native' 
          : `${bal.asset_code}:${bal.asset_issuer}`,
        balance: bal.balance,
      }));

      return {
        address: account.accountId(),
        sequence: account.sequence,
        balances,
      };
    } catch (error: any) {
      throw new Error(`Failed to load account: ${error.message}`);
    }
  }

  /**
   * Submit a signed transaction to the network
   */
  async submitTransaction(transactionXdr: string): Promise<StellarTransactionResult> {
    try {
      const response = await this.withRetries(() =>
        this.server.submitTransaction(new Transaction(transactionXdr, this.networkPassphrase))
      );

      return {
        hash: (response as any).hash,
        ledger: (response as any).ledger,
        successful: (response as any).successful,
        resultXdr: (response as any).result_xdr,
        envelopeXdr: (response as any).envelope_xdr,
      };
    } catch (error: any) {
      const message = error?.response?.data?.extras?.result_codes
        ? JSON.stringify(error.response.data.extras.result_codes)
        : error?.message;
      throw new Error(`Transaction submission failed: ${message}`);
    }
  }

  /**
   * Submit a fee bump transaction to the network
   * Fee bump transactions allow increasing the fee of a pending transaction
   * This is useful when a transaction is stuck due to insufficient fees
   * 
   * @param feeBumpTransactionXdr - The XDR of the fee bump transaction
   * @returns The transaction result including the new hash
   */
  async submitFeeBumpTransaction(feeBumpTransactionXdr: string): Promise<StellarTransactionResult> {
    try {
      const feeBumpTx = new FeeBumpTransaction(feeBumpTransactionXdr, this.networkPassphrase);

      const response = await this.withRetries(() => this.server.submitTransaction(feeBumpTx));

      return {
        hash: response.hash,
        ledger: response.ledger,
        successful: response.successful,
        resultXdr: response.result_xdr,
        envelopeXdr: response.envelope_xdr,
      };
    } catch (error: any) {
      const message = error.response?.data?.extras?.result_codes 
        ? JSON.stringify(error.response.data.extras.result_codes)
        : error.message;
      throw new Error(`Fee bump transaction submission failed: ${message}`);
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(hash: string): Promise<any> {
    try {
      const tx = await this.server.transactions().transaction(hash).call();
      return tx;
    } catch (error: any) {
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  /**
   * Fetch a transaction and its operations.
   * Note: Horizon's transaction endpoint typically does not inline operations.
   */
  async getTransactionWithOperations(hash: string): Promise<any> {
    try {
      const tx = await this.getTransaction(hash);
      const operationsPage = await (this.server as any).operations().forTransaction(hash).call();
      return {
        ...tx,
        operations: Array.isArray(operationsPage?.records) ? operationsPage.records : operationsPage,
      };
    } catch (error: any) {
      throw new Error(`Failed to get transaction with operations: ${error.message}`);
    }
  }

  /**
   * Get fee statistics from the network
   */
  async getFeeStats(): Promise<Horizon.HorizonApi.FeeStatsResponse> {
    try {
      return await this.server.feeStats();
    } catch (error: any) {
      throw new Error(`Failed to get fee stats: ${error.message}`);
    }
  }

  /**
   * Check if account exists on the network
   */
  async accountExists(address: string): Promise<boolean> {
    try {
      await this.server.loadAccount(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the current ledger number
   */
  async getLedgerNumber(): Promise<number> {
    try {
      const ledgers = await this.server.ledgers().order('desc').limit(1).call();
      return ledgers.records[0]?.sequence || 0;
    } catch (error: any) {
      throw new Error(`Failed to get ledger number: ${error.message}`);
    }
  }
}
