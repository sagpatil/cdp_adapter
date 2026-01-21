// StellarWalletAdapter - Main entry point orchestrating all components
import type { CDPAdapterConfig, CDPWallet, CDPTransaction, CDPTransactionRequest, Network } from '../types/cdp';
import type { StellarNetworkConfig, StellarKeypair, FeeBumpConfig } from '../types/stellar';
import { DEFAULT_HORIZON_URLS, DEFAULT_SOROBAN_RPC_URLS, NETWORK_PASSPHRASES, STELLAR_FOUNDATION_SPONSORS } from '../types/stellar';
import { TransactionBuilder } from './TransactionBuilder';
import { Signer } from './Signer';
import { FeeEstimator } from './FeeEstimator';
import { StellarRpcClient } from '../rpc/StellarRpcClient';
import { EventNormalizer } from '../events/EventNormalizer';
import { TransactionRequestSchema } from '../types/cdp';

export class StellarWalletAdapter {
  private config: CDPAdapterConfig;
  private networkConfig: StellarNetworkConfig;
  private rpcClient: StellarRpcClient;
  private transactionBuilder: TransactionBuilder;
  private signer: Signer;
  private feeEstimator: FeeEstimator;
  private eventNormalizer: EventNormalizer;
  private walletStore: Map<string, { wallet: CDPWallet; keypair: StellarKeypair }>;

  constructor(config: CDPAdapterConfig) {
    this.config = config;
    
    // Build network configuration
    this.networkConfig = {
      network: config.network,
      horizonUrl: config.horizonUrl || DEFAULT_HORIZON_URLS[config.network],
      sorobanRpcUrl: config.sorobanRpcUrl || DEFAULT_SOROBAN_RPC_URLS[config.network],
      networkPassphrase: NETWORK_PASSPHRASES[config.network],
    };

    // Initialize components
    this.rpcClient = new StellarRpcClient(this.networkConfig);
    this.transactionBuilder = new TransactionBuilder(this.networkConfig.networkPassphrase);
    this.signer = new Signer();
    this.feeEstimator = new FeeEstimator(this.rpcClient);
    this.eventNormalizer = new EventNormalizer();
    this.walletStore = new Map();
  }

  /**
   * Create a new wallet
   */
  async createWallet(): Promise<CDPWallet> {
    // Generate new keypair
    const keypair = this.signer.generateKeypair();

    // Create wallet object
    const wallet: CDPWallet = {
      id: this.generateWalletId(),
      address: keypair.publicKey,
      network: this.config.network,
      createdAt: new Date().toISOString(),
    };

    // Store wallet and keypair
    this.walletStore.set(wallet.address, { wallet, keypair });

    return wallet;
  }

  /**
   * Get wallet by address
   */
  async getWallet(address: string): Promise<CDPWallet> {
    const stored = this.walletStore.get(address);
    if (!stored) {
      throw new Error(`Wallet not found: ${address}`);
    }
    return stored.wallet;
  }

  /**
   * Send a transaction
   */
  async sendTransaction(request: CDPTransactionRequest): Promise<CDPTransaction> {
    // Validate request
    const validatedRequest = TransactionRequestSchema.parse(request);

    // Get wallet and keypair
    const stored = this.walletStore.get(request.from);
    if (!stored) {
      throw new Error(`Wallet not found: ${request.from}`);
    }

    try {
      // Load source account from network
      const sourceAccount = await this.rpcClient.loadAccount(request.from);

      // Estimate fee
      const fee = await this.feeEstimator.estimateFee(1);

      // Build transaction
      const transaction = await this.transactionBuilder.buildPaymentTransaction(
        validatedRequest,
        sourceAccount,
        fee
      );

      // Sign transaction
      const signedTransaction = this.signer.signTransaction(
        transaction,
        stored.keypair.secretKey
      );

      // Create pending transaction object
      const cdpTransaction: CDPTransaction = {
        id: this.generateTransactionId(),
        hash: signedTransaction.hash().toString('hex'),
        status: 'pending',
        from: request.from,
        to: request.to,
        amount: request.amount,
        asset: request.asset || 'native',
        fee,
        createdAt: new Date().toISOString(),
      };

      // Submit to network
      const result = await this.rpcClient.submitTransaction(signedTransaction.toXDR());

      // Update transaction with result
      cdpTransaction.status = result.successful ? 'success' : 'failed';
      cdpTransaction.confirmedAt = new Date().toISOString();
      cdpTransaction.ledger = result.ledger;

      return cdpTransaction;
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(hash: string): Promise<CDPTransaction> {
    try {
      const tx = await this.rpcClient.getTransaction(hash);

      // Best-effort extraction of destination, amount and asset from operations (if present)
      let to = '';
      let amount = '';
      let asset = 'native';

      const txAny: any = tx as any;
      const operations = Array.isArray(txAny.operations) ? txAny.operations : undefined;
      if (operations && operations.length > 0) {
        const paymentOp = operations.find((op: any) => op && op.type === 'payment');
        if (paymentOp) {
          if (typeof paymentOp.to === 'string') {
            to = paymentOp.to;
          }
          if (typeof paymentOp.amount === 'string') {
            amount = paymentOp.amount;
          }
          if (typeof paymentOp.asset_type === 'string') {
            if (paymentOp.asset_type === 'native') {
              asset = 'native';
            } else if (typeof paymentOp.asset_code === 'string' && paymentOp.asset_code.length > 0) {
              asset = paymentOp.asset_code;
            }
          }
        }
      }

      // Convert Stellar transaction to CDP format
      const cdpTransaction: CDPTransaction = {
        id: hash,
        hash: tx.hash,
        status: tx.successful ? 'success' : 'failed',
        from: tx.source_account,
        to,
        amount,
        asset,
        fee: tx.fee_charged,
        createdAt: tx.created_at,
        confirmedAt: tx.created_at,
        ledger: tx.ledger,
      };

      return cdpTransaction;
    } catch (error: any) {
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  /**
   * Get wallet keypair (internal use only - be careful with secret keys!)
   */
  getWalletKeypair(address: string): StellarKeypair | undefined {
    return this.walletStore.get(address)?.keypair;
  }

  /**
   * Import an existing wallet by secret key
   */
  async importWallet(secretKey: string): Promise<CDPWallet> {
    const publicKey = this.signer.getPublicKey(secretKey);

    const wallet: CDPWallet = {
      id: this.generateWalletId(),
      address: publicKey,
      network: this.config.network,
      createdAt: new Date().toISOString(),
    };

    this.walletStore.set(wallet.address, {
      wallet,
      keypair: {
        publicKey,
        secretKey,
      },
    });

    return wallet;
  }

  /**
   * Create a fee bump transaction sponsored by Stellar Foundation
   * This increases the fee of a pending transaction to help it get included in a ledger
   * 
   * @param transactionHash - Hash of the original transaction to bump
   * @param maxFee - Maximum fee willing to pay (in stroops)
   * @param sponsorSecretKey - Optional: Secret key of the sponsor account. If not provided, uses Stellar Foundation sponsor
   * @returns The bumped transaction result
   */
  async feeBumpTransaction(
    transactionHash: string,
    maxFee: string,
    sponsorSecretKey?: string,
  ): Promise<CDPTransaction> {
    try {
      // Get the original transaction
      const originalTx = await this.rpcClient.getTransaction(transactionHash);
      const originalEnvelopeXdr = originalTx.envelope_xdr;

      // Determine the fee source (sponsor)
      let feeSourceSecret: string;
      let feeSourceAddress: string;

      if (sponsorSecretKey) {
        // Use provided sponsor
        feeSourceSecret = sponsorSecretKey;
        feeSourceAddress = this.signer.getPublicKey(sponsorSecretKey);
      } else {
        // Use Stellar Foundation sponsor for the current network
        // Note: In production, this would require secure key management
        // For now, this is a placeholder - the actual secret key would need to be configured
        throw new Error(
          'Stellar Foundation sponsorship requires configuration of sponsor secret key. ' +
          `Please provide sponsorSecretKey parameter or configure STELLAR_FOUNDATION_SPONSOR_SECRET_KEY environment variable for ${this.config.network}`
        );
      }

      // Build fee bump transaction
      const feeBumpConfig: FeeBumpConfig = {
        maxFee,
        feeSource: feeSourceAddress,
      };

      const feeBumpTx = this.transactionBuilder.buildFeeBumpTransaction(
        originalEnvelopeXdr,
        feeBumpConfig,
        feeSourceAddress
      );

      // Sign the fee bump transaction with the sponsor's key
      const signedFeeBumpTx = this.signer.signFeeBumpTransaction(
        feeBumpTx,
        feeSourceSecret
      );

      // Submit the fee bump transaction
      const result = await this.rpcClient.submitFeeBumpTransaction(
        signedFeeBumpTx.toXDR()
      );

      // Best-effort extraction of destination, amount and asset from original transaction
      let to = '';
      let amount = '';
      let asset = 'native';

      const txAny: any = originalTx as any;
      const operations = Array.isArray(txAny.operations) ? txAny.operations : undefined;
      if (operations && operations.length > 0) {
        const paymentOp = operations.find((op: any) => op && op.type === 'payment');
        if (paymentOp) {
          if (typeof paymentOp.to === 'string') {
            to = paymentOp.to;
          }
          if (typeof paymentOp.amount === 'string') {
            amount = paymentOp.amount;
          }
          if (typeof paymentOp.asset_type === 'string') {
            if (paymentOp.asset_type === 'native') {
              asset = 'native';
            } else if (typeof paymentOp.asset_code === 'string' && paymentOp.asset_code.length > 0) {
              asset = paymentOp.asset_code;
            }
          }
        }
      }

      // Create CDP transaction object for the fee bump
      const cdpTransaction: CDPTransaction = {
        id: this.generateTransactionId(),
        hash: result.hash,
        status: result.successful ? 'success' : 'failed',
        from: originalTx.source_account,
        to,
        amount,
        asset,
        fee: maxFee,
        createdAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        ledger: result.ledger,
      };

      return cdpTransaction;
    } catch (error: any) {
      throw new Error(`Fee bump failed: ${error.message}`);
    }
  }

  /**
   * Get the Stellar Foundation sponsor address for the current network
   */
  getStellarFoundationSponsor(): string {
    return STELLAR_FOUNDATION_SPONSORS[this.config.network];
  }

  // Helper methods
  private generateWalletId(): string {
    return `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
