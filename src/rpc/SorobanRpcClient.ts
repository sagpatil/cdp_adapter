// SorobanRpcClient - Soroban smart contract RPC client
import * as StellarSdk from '@stellar/stellar-sdk';
import { Transaction, Keypair, Contract, TransactionBuilder } from '@stellar/stellar-sdk';
import type { StellarNetworkConfig } from '../types/stellar';

export type SorobanInvokeOptions = {
  /** Secret key for the transaction source account (required to submit). */
  sourceSecretKey?: string;
  /** Fee in stroops (string). Defaults to "100" before preparation. */
  fee?: string;
  /** Transaction timeout. Defaults to 300 seconds. */
  timeoutSeconds?: number;
  /** If false, returns the prepared XDR without submitting. Defaults to true when sourceSecretKey is provided. */
  submit?: boolean;
};

export class SorobanRpcClient {
  private server: StellarSdk.SorobanRpc.Server;
  private networkPassphrase: string;

  constructor(
    config: StellarNetworkConfig,
    options?: {
      server?: StellarSdk.SorobanRpc.Server;
    }
  ) {
    this.server = options?.server ?? new StellarSdk.SorobanRpc.Server(config.sorobanRpcUrl);
    this.networkPassphrase = config.networkPassphrase;
  }

  /**
   * Invoke a Soroban smart contract.
   *
   * If `options.sourceSecretKey` is not provided, this will return a non-throwing
   * response explaining what is missing.
   */
  async invokeContract(contractId: string, method: string, params: any[], options?: SorobanInvokeOptions): Promise<any> {
    const shouldSubmit = options?.submit ?? Boolean(options?.sourceSecretKey);
    if (!options?.sourceSecretKey) {
      return {
        status: 'missing_source_secret',
        message: 'sourceSecretKey is required to build and submit a Soroban invocation transaction',
      };
    }

    const keypair = Keypair.fromSecret(options.sourceSecretKey);
    const sourcePublicKey = keypair.publicKey();

    // Convert params into ScVals
    const scVals = (params ?? []).map((value) => {
      // Pass through ScVal objects
      if (value && typeof value === 'object' && typeof (value as any).switch === 'function') {
        return value;
      }
      return StellarSdk.nativeToScVal(value);
    });

    const contract = new Contract(contractId);
    const operation = contract.call(method, ...scVals);

    const fee = (options.fee ?? '100').toString();
    const timeoutSeconds = options.timeoutSeconds ?? 300;

    // Account must exist on network.
    const account = await this.server.getAccount(sourcePublicKey);

    const transaction = new TransactionBuilder(account as any, {
      fee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(timeoutSeconds)
      .build();

    // Prepare (simulate + assemble footprints/resources)
    const prepared = await this.server.prepareTransaction(transaction as any);
    (prepared as any).sign(keypair);

    if (!shouldSubmit) {
      return {
        status: 'prepared',
        transactionXdr: (prepared as any).toXDR(),
      };
    }

    const sendResult = await this.server.sendTransaction(prepared as any);
    return {
      ...sendResult,
      status: 'submitted',
    };
  }

  /**
   * Fetch contract instance data.
   * Returns the raw RPC response (ledger entry).
   */
  async getContractData(contractId: string): Promise<any> {
    // stellar-sdk Server#getContractData expects (contractId, key)
    const key = StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance();
    return this.server.getContractData(contractId, key as any);
  }

  /**
   * Simulate a transaction via Soroban RPC.
   */
  async simulateTransaction(transactionXdr: string): Promise<any> {
    const tx = new Transaction(transactionXdr, this.networkPassphrase);
    return this.server.simulateTransaction(tx as any);
  }
}
