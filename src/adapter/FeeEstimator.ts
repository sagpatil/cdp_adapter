// FeeEstimator - Calculates Stellar transaction fees
import { BASE_FEE } from '@stellar/stellar-sdk';
import type { StellarRpcClient } from '../rpc/StellarRpcClient';

export class FeeEstimator {
  private rpcClient: StellarRpcClient;

  constructor(rpcClient: StellarRpcClient) {
    this.rpcClient = rpcClient;
  }

  /**
   * Estimate fee for a transaction
   * For simple payments, use base fee. For complex operations, query network.
   */
  async estimateFee(operationCount: number = 1): Promise<string> {
    if (
      !Number.isFinite(operationCount) ||
      !Number.isInteger(operationCount) ||
      operationCount <= 0
    ) {
      throw new RangeError('operationCount must be a positive integer');
    }

    try {
      // Try to get current fee stats from the network
      const feeStats = await this.rpcClient.getFeeStats();
      
      // Use the mode (most common) fee or fall back to base fee
      const baseFee = feeStats?.fee_charged?.mode 
        ? parseInt(feeStats.fee_charged.mode, 10)
        : parseInt(BASE_FEE, 10);
      
      // Total fee = base fee * number of operations
      const totalFee = baseFee * operationCount;
      
      return totalFee.toString();
    } catch (error) {
      // If fee stats unavailable, use default base fee
      const totalFee = parseInt(BASE_FEE, 10) * operationCount;
      return totalFee.toString();
    }
  }

  /**
   * Get the minimum base fee
   */
  getBaseFee(): string {
    return BASE_FEE;
  }
}
