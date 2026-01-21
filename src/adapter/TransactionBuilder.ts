// TransactionBuilder - Builds Stellar payment transactions (XDR format)
import { 
  TransactionBuilder as StellarTransactionBuilder,
  Operation,
  Asset,
  Memo,
  Transaction,
  FeeBumpTransaction,
} from '@stellar/stellar-sdk';
import type { CDPTransactionRequest } from '../types/cdp';
import type { StellarAccount, StellarTransactionEnvelope, StellarOperation, FeeBumpConfig } from '../types/stellar';

export class TransactionBuilder {
  private networkPassphrase: string;

  constructor(networkPassphrase: string) {
    this.networkPassphrase = networkPassphrase;
  }

  /**
   * Build a payment transaction
   */
  async buildPaymentTransaction(
    request: CDPTransactionRequest,
    sourceAccount: StellarAccount,
    fee: string,
  ): Promise<Transaction> {
    // Parse asset - 'native' for XLM, or 'CODE:ISSUER' format
    const asset = this.parseAsset(request.asset || 'native');

    // Build transaction
    const txBuilder = new StellarTransactionBuilder(
      {
        accountId: () => sourceAccount.address,
        sequenceNumber: () => sourceAccount.sequence,
        incrementSequenceNumber: () => {},
      } as any,
      {
        fee,
        networkPassphrase: this.networkPassphrase,
      }
    );

    // Add payment operation
    txBuilder.addOperation(
      Operation.payment({
        destination: request.to,
        asset,
        amount: request.amount,
      })
    );

    // Add memo if provided
    if (request.memo) {
      txBuilder.addMemo(this.parseMemo(request.memo, request.memoType || 'text'));
    }

    // Set timeout (5 minutes)
    txBuilder.setTimeout(300);

    return txBuilder.build();
  }

  /**
   * Build a fee bump transaction to increase the fee of an existing transaction
   * This allows a transaction to be prioritized or rescued if it's stuck due to low fees
   * 
   * @param innerTransactionXdr - The XDR of the original transaction to bump
   * @param feeBumpConfig - Configuration for fee bump (maxFee and optional sponsor)
   * @param feeSourceAccount - The account that will pay the bumped fee (sponsor)
   * @returns A fee bump transaction ready to be signed by the fee source
   */
  buildFeeBumpTransaction(
    innerTransactionXdr: string,
    feeBumpConfig: FeeBumpConfig,
    feeSourceAccount: string,
  ): FeeBumpTransaction {
    // Parse the inner transaction
    const innerTransaction = new Transaction(innerTransactionXdr, this.networkPassphrase);

    // Build fee bump transaction
    // The fee source (sponsor) pays the fee, allowing the original transaction to succeed
    const feeBumpTx = StellarTransactionBuilder.buildFeeBumpTransaction(
      feeBumpConfig.feeSource || feeSourceAccount,
      feeBumpConfig.maxFee,
      innerTransaction,
      this.networkPassphrase
    );

    return feeBumpTx;
  }

  /**
   * Parse asset string to Stellar Asset object
   */
  private parseAsset(assetString: string): Asset {
    if (assetString === 'native' || assetString === 'XLM') {
      return Asset.native();
    }

    const parts = assetString.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid asset format: ${assetString}. Expected 'CODE:ISSUER' or 'native'`);
    }

    const [code, issuer] = parts;
    return new Asset(code, issuer);
  }

  /**
   * Parse memo based on type
   */
  private parseMemo(memo: string, memoType: string): Memo {
    switch (memoType) {
      case 'text':
        return Memo.text(memo);
      case 'id':
        return Memo.id(memo);
      case 'hash':
        return Memo.hash(memo);
      case 'return':
        return Memo.return(memo);
      default:
        return Memo.text(memo);
    }
  }

  /**
   * Convert Transaction to StellarTransactionEnvelope
   */
  transactionToEnvelope(transaction: Transaction): StellarTransactionEnvelope {
    const operations: StellarOperation[] = transaction.operations.map((op: any) => ({
      type: op.type,
      destination: op.destination,
      amount: op.amount,
      asset: op.asset ? (op.asset.isNative() ? 'native' : `${op.asset.code}:${op.asset.issuer}`) : undefined,
    }));

    return {
      xdr: transaction.toXDR(),
      hash: transaction.hash().toString('hex'),
      sourceAccount: transaction.source,
      fee: transaction.fee,
      sequence: transaction.sequence,
      operations,
    };
  }
}
