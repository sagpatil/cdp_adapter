import { StellarWalletAdapter } from '../src/adapter/StellarWalletAdapter';
import { EventNormalizer } from '../src/events/EventNormalizer';
import { Keypair } from '@stellar/stellar-sdk';

describe('StellarWalletAdapter incomplete areas', () => {
  afterEach(() => {
    delete process.env.STELLAR_FOUNDATION_SPONSOR_SECRET_KEY;
    delete process.env.STELLAR_FOUNDATION_SPONSOR_SECRET_TESTNET;
  });

  it('emits wallet.created on createWallet', async () => {
    const onEvent = jest.fn();
    const adapter = new StellarWalletAdapter({ network: 'testnet', onEvent });

    await adapter.createWallet();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].type).toBe('wallet.created');
  });

  it('emits transaction.pending + transaction.success on sendTransaction', async () => {
    const onEvent = jest.fn();

    const fromKeypair = Keypair.random();
    const toKeypair = Keypair.random();

    const fakeRpcClient: any = {
      loadAccount: jest.fn().mockResolvedValue({ address: fromKeypair.publicKey(), sequence: '1', balances: [] }),
      submitTransaction: jest.fn().mockResolvedValue({ successful: true, ledger: 123, hash: 'h', resultXdr: 'r', envelopeXdr: 'e' }),
    };

    const fakeFeeEstimator: any = {
      estimateFee: jest.fn().mockResolvedValue('100'),
    };

    const fakeTransactionBuilder: any = {
      buildPaymentTransaction: jest.fn().mockResolvedValue({}),
    };

    const fakeSigner: any = {
      signTransaction: jest.fn().mockReturnValue({
        hash: () => Buffer.from('abcd', 'hex'),
        toXDR: () => 'xdr',
      }),
    };

    const adapter = new StellarWalletAdapter(
      { network: 'testnet', onEvent },
      {
        rpcClient: fakeRpcClient,
        feeEstimator: fakeFeeEstimator,
        transactionBuilder: fakeTransactionBuilder,
        signer: fakeSigner,
        eventNormalizer: new EventNormalizer(),
      }
    );

    // Seed wallet store
    const wallet: any = { id: 'w1', address: fromKeypair.publicKey(), network: 'testnet', createdAt: new Date().toISOString() };
    (adapter as any).walletStore.set(fromKeypair.publicKey(), { wallet, keypair: { publicKey: fromKeypair.publicKey(), secretKey: 'S'.padEnd(56, 'A') } });

    await adapter.sendTransaction({ from: fromKeypair.publicKey(), to: toKeypair.publicKey(), amount: '1', asset: 'native' });

    expect(onEvent).toHaveBeenCalled();
    const types = onEvent.mock.calls.map((c) => c[0].type);
    expect(types).toContain('transaction.pending');
    expect(types).toContain('transaction.success');
  });

  it('uses env sponsor secret when sponsorSecretKey not provided', async () => {
    process.env.STELLAR_FOUNDATION_SPONSOR_SECRET_TESTNET = 'SENVSPONSOR';

    const onEvent = jest.fn();

    const fakeRpcClient: any = {
      getTransactionWithOperations: jest.fn().mockResolvedValue({
        envelope_xdr: 'INNERXDR',
        source_account: 'GFROM',
        operations: [{ type: 'payment', to: 'GTO', amount: '1', asset_type: 'native' }],
      }),
      submitFeeBumpTransaction: jest.fn().mockResolvedValue({ successful: true, ledger: 777, hash: 'h2', resultXdr: 'r', envelopeXdr: 'e' }),
    };

    const fakeTransactionBuilder: any = {
      buildFeeBumpTransaction: jest.fn().mockReturnValue({ toXDR: () => 'FBXDR' }),
    };

    const fakeSigner: any = {
      getPublicKey: jest.fn().mockReturnValue('GSPONSOR'),
      signFeeBumpTransaction: jest.fn().mockReturnValue({ toXDR: () => 'SIGNEDFBXDR' }),
    };

    const adapter = new StellarWalletAdapter(
      { network: 'testnet', onEvent },
      {
        rpcClient: fakeRpcClient,
        transactionBuilder: fakeTransactionBuilder,
        signer: fakeSigner,
        eventNormalizer: new EventNormalizer(),
      }
    );

    const tx = await adapter.feeBumpTransaction('HASH', '200');
    expect(tx.status).toBe('success');
    expect(fakeSigner.getPublicKey).toHaveBeenCalledWith('SENVSPONSOR');
  });
});
