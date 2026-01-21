import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASES, DEFAULT_HORIZON_URLS } from '../src/types/stellar';
import { StellarRpcClient } from '../src/rpc/StellarRpcClient';

function buildPaymentTxXdr(networkPassphrase: string): string {
  const source = StellarSdk.Keypair.random();
  const destination = StellarSdk.Keypair.random();
  const account = new StellarSdk.Account(source.publicKey(), '1');

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destination.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '1',
      })
    )
    .setTimeout(0)
    .build();

  tx.sign(source);
  return tx.toXDR();
}

function buildFeeBumpTxXdr(networkPassphrase: string): string {
  const innerXdr = buildPaymentTxXdr(networkPassphrase);
  const inner = new StellarSdk.Transaction(innerXdr, networkPassphrase);
  const sponsor = StellarSdk.Keypair.random();

  const feeBump = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    sponsor.publicKey(),
    '200',
    inner,
    networkPassphrase
  );

  feeBump.sign(sponsor);
  return feeBump.toXDR();
}

describe('StellarRpcClient retries', () => {
  const config = {
    network: 'testnet' as const,
    horizonUrl: DEFAULT_HORIZON_URLS.testnet,
    sorobanRpcUrl: 'https://example.invalid',
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  };

  it('retries submitTransaction on retryable errors', async () => {
    const server: any = {
      submitTransaction: jest
        .fn()
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockResolvedValue({
          hash: 'hash',
          ledger: 123,
          successful: true,
          result_xdr: 'rx',
          envelope_xdr: 'ex',
        }),
    };

    const client = new StellarRpcClient(config as any, { server, maxRetries: 2 });
    const xdr = buildPaymentTxXdr(NETWORK_PASSPHRASES.testnet);

    const result = await client.submitTransaction(xdr);
    expect(result.successful).toBe(true);
    expect(server.submitTransaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry submitTransaction on non-retryable errors', async () => {
    const server: any = {
      submitTransaction: jest.fn().mockRejectedValue({ response: { status: 400 }, message: 'bad' }),
    };

    const client = new StellarRpcClient(config as any, { server, maxRetries: 3 });
    const xdr = buildPaymentTxXdr(NETWORK_PASSPHRASES.testnet);

    await expect(client.submitTransaction(xdr)).rejects.toThrow('Transaction submission failed');
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('retries submitFeeBumpTransaction on retryable errors', async () => {
    const server: any = {
      submitTransaction: jest
        .fn()
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue({
          hash: 'hash2',
          ledger: 456,
          successful: true,
          result_xdr: 'rx',
          envelope_xdr: 'ex',
        }),
    };

    const client = new StellarRpcClient(config as any, { server, maxRetries: 2 });
    const xdr = buildFeeBumpTxXdr(NETWORK_PASSPHRASES.testnet);

    const result = await client.submitFeeBumpTransaction(xdr);
    expect(result.successful).toBe(true);
    expect(server.submitTransaction).toHaveBeenCalledTimes(2);
  });
});
