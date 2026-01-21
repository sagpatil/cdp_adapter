import { FeeEstimator } from '../src/adapter/FeeEstimator';

describe('FeeEstimator', () => {
  it('throws for invalid operationCount', async () => {
    const rpcClient: any = { getFeeStats: jest.fn() };
    const estimator = new FeeEstimator(rpcClient);

    await expect(estimator.estimateFee(0)).rejects.toThrow(RangeError);
    await expect(estimator.estimateFee(-1)).rejects.toThrow(RangeError);
    await expect(estimator.estimateFee(1.5 as any)).rejects.toThrow(RangeError);
  });

  it('uses Horizon feeStats mode when available', async () => {
    const rpcClient: any = {
      getFeeStats: jest.fn().mockResolvedValue({
        fee_charged: { mode: '100' },
      }),
    };
    const estimator = new FeeEstimator(rpcClient);

    await expect(estimator.estimateFee(2)).resolves.toBe('200');
  });

  it('falls back to BASE_FEE when feeStats unavailable', async () => {
    const rpcClient: any = {
      getFeeStats: jest.fn().mockRejectedValue(new Error('nope')),
    };
    const estimator = new FeeEstimator(rpcClient);

    const fee = await estimator.estimateFee(2);
    expect(typeof fee).toBe('string');
    expect(Number(fee)).toBeGreaterThan(0);
  });
});
