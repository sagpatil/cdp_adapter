// StellarRpcClient - Horizon API client for account management and transaction submission
import { Horizon, Networks } from '@stellar/stellar-sdk';
import * as StellarSdk from '@stellar/stellar-sdk';
import type { Network } from '../types/cdp';
import type { StellarAccount, StellarBalance, StellarTransactionResult, StellarNetworkConfig } from '../types/stellar';
import { NETWORK_PASSPHRASES } from '../types/stellar';

export class StellarRpcClient {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;

  constructor(config: StellarNetworkConfig) {
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.networkPassphrase = config.networkPassphrase;
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
      const response = await this.server.submitTransaction(
        new (await import('@stellar/stellar-sdk')).Transaction(transactionXdr, this.networkPassphrase)
      );

      return {
        hash: response.hash,
        ledger: response.ledger,
        successful: response.successful,
        resultXdr: response.result_xdr,
        envelopeXdr: response.envelope_xdr,
      };
    } catch (error: any) {
      // Horizon returns detailed error in response
      const message = error.response?.data?.extras?.result_codes 
        ? JSON.stringify(error.response.data.extras.result_codes)
        : error.message;
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
      const FeeBumpTransaction = (await import('@stellar/stellar-sdk')).FeeBumpTransaction;
      const feeBumpTx = new FeeBumpTransaction(feeBumpTransactionXdr, this.networkPassphrase);
      
      const response = await this.server.submitTransaction(feeBumpTx);

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
