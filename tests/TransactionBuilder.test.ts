import { TransactionBuilder } from '../src/adapter/TransactionBuilder';
import { Keypair } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASES } from '../src/types/stellar';
import type { CDPTransactionRequest } from '../src/types/cdp';
import type { StellarAccount } from '../src/types/stellar';

describe('TransactionBuilder', () => {
  let builder: TransactionBuilder;
  let mockAccount: StellarAccount;
  let sourceKeypair: any;
  let destinationKeypair: any;
  let issuerKeypair: any;
  let sponsorKeypair: any;

  beforeEach(() => {
    builder = new TransactionBuilder(NETWORK_PASSPHRASES.testnet);
    
    // Generate valid keypairs for testing
    sourceKeypair = Keypair.random();
    destinationKeypair = Keypair.random();
    issuerKeypair = Keypair.random();
    sponsorKeypair = Keypair.random();
    
    mockAccount = {
      address: sourceKeypair.publicKey(),
      sequence: '123456789',
      balances: [
        { asset: 'native', balance: '1000' },
      ],
    };
  });

  describe('buildPaymentTransaction', () => {
    it('should build a basic payment transaction', async () => {
      const request: CDPTransactionRequest = {
        from: mockAccount.address,
        to: destinationKeypair.publicKey(),
        amount: '10',
        asset: 'native',
      };

      const transaction = await builder.buildPaymentTransaction(
        request,
        mockAccount,
        '100'
      );

      expect(transaction).toBeDefined();
      expect(transaction.source).toBe(mockAccount.address);
      expect(transaction.fee).toBe('100');
      expect(transaction.operations).toHaveLength(1);
      expect(transaction.operations[0].type).toBe('payment');
    });

    it('should build transaction with memo', async () => {
      const request: CDPTransactionRequest = {
        from: mockAccount.address,
        to: destinationKeypair.publicKey(),
        amount: '10',
        asset: 'native',
        memo: 'Test payment',
        memoType: 'text',
      };

      const transaction = await builder.buildPaymentTransaction(
        request,
        mockAccount,
        '100'
      );

      expect(transaction.memo.type).toBe('text');
      expect(transaction.memo.value?.toString()).toBe('Test payment');
    });

    it('should handle custom assets', async () => {
      const request: CDPTransactionRequest = {
        from: mockAccount.address,
        to: destinationKeypair.publicKey(),
        amount: '10',
        asset: `USDC:${issuerKeypair.publicKey()}`,
      };

      const transaction = await builder.buildPaymentTransaction(
        request,
        mockAccount,
        '100'
      );

      const operation = transaction.operations[0] as any;
      expect(operation.asset.code).toBe('USDC');
      expect(operation.asset.issuer).toBe(issuerKeypair.publicKey());
    });
  });

  describe('buildFeeBumpTransaction', () => {
    it('should build a fee bump transaction', async () => {
      // First create a regular transaction
      const request: CDPTransactionRequest = {
        from: mockAccount.address,
        to: destinationKeypair.publicKey(),
        amount: '10',
        asset: 'native',
      };

      const innerTx = await builder.buildPaymentTransaction(
        request,
        mockAccount,
        '100'
      );

      // Build fee bump transaction
      const feeSourceAccount = sponsorKeypair.publicKey();
      const feeBumpTx = builder.buildFeeBumpTransaction(
        innerTx.toXDR(),
        { maxFee: '200' },
        feeSourceAccount
      );

      expect(feeBumpTx).toBeDefined();
      expect(feeBumpTx.feeSource).toBe(feeSourceAccount);
      // Fee bump transaction fee should be at least the inner transaction fee
      expect(parseInt(feeBumpTx.fee)).toBeGreaterThanOrEqual(parseInt(innerTx.fee));
    });
  });
});
