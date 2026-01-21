import * as StellarSdk from '@stellar/stellar-sdk';
import { SorobanRpcClient } from '../src/rpc/SorobanRpcClient';
import { NETWORK_PASSPHRASES } from '../src/types/stellar';

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

describe('SorobanRpcClient', () => {
  const config = {
    network: 'testnet' as const,
    horizonUrl: 'https://example.invalid',
    sorobanRpcUrl: 'https://soroban.example.invalid',
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  };

  it('returns a non-throwing response when sourceSecretKey is missing', async () => {
    const server: any = {};
    const client = new SorobanRpcClient(config as any, { server });

    const res = await client.invokeContract('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'hello', []);
    expect(res.status).toBe('missing_source_secret');
  });

  it('wraps simulateTransaction', async () => {
    const server: any = {
      simulateTransaction: jest.fn().mockResolvedValue({ ok: true }),
    };
    const client = new SorobanRpcClient(config as any, { server });

    const xdr = buildPaymentTxXdr(NETWORK_PASSPHRASES.testnet);
    const result = await client.simulateTransaction(xdr);

    expect(result).toEqual({ ok: true });
    expect(server.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it('wraps getContractData with the contract-instance key', async () => {
    const server: any = {
      getContractData: jest.fn().mockResolvedValue({ entry: 'ok' }),
    };
    const client = new SorobanRpcClient(config as any, { server });

    const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const res = await client.getContractData(contractId);

    expect(res).toEqual({ entry: 'ok' });
    expect(server.getContractData).toHaveBeenCalledTimes(1);

    const [, key] = server.getContractData.mock.calls[0];
    expect(key.switch().name).toBe('scvLedgerKeyContractInstance');
  });

  it('invokes contract via prepareTransaction + sendTransaction', async () => {
    const source = StellarSdk.Keypair.random();

    const server: any = {
      getAccount: jest.fn().mockResolvedValue(new StellarSdk.Account(source.publicKey(), '1')),
      prepareTransaction: jest.fn(async (tx: any) => tx),
      sendTransaction: jest.fn().mockResolvedValue({ hash: 'abc', status: 'PENDING' }),
    };

    const client = new SorobanRpcClient(config as any, { server });
    const contractId = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 1));

    const res = await client.invokeContract(contractId, 'hello', ['world'], {
      sourceSecretKey: source.secret(),
    });

    expect(server.getAccount).toHaveBeenCalledTimes(1);
    expect(server.prepareTransaction).toHaveBeenCalledTimes(1);
    expect(server.sendTransaction).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('submitted');
    expect(res.hash).toBe('abc');
  });
});
