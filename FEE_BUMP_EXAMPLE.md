# CDP Stellar Adapter - Fee Bump Example

This example demonstrates how to use the fee bump transaction feature.

## What is Fee Bumping?

Fee bumping allows you to increase the fee of a pending transaction that hasn't been included in a ledger yet. This is useful when:
- Network fees increase after you submit a transaction
- Your transaction is stuck due to insufficient fees
- You need to prioritize your transaction

## Fee Bump with Stellar Foundation Sponsorship

The CDP Stellar Adapter supports fee bump transactions sponsored by the Stellar Foundation, where the sponsor account pays the additional fee.

## Example Usage

### Using the SDK

```typescript
import { StellarWalletAdapter } from '@stellar/cdp-adapter';

async function feeBumpExample() {
  const adapter = new StellarWalletAdapter({
    network: 'testnet',
  });

  // Create a wallet and send a transaction
  const wallet = await adapter.createWallet();
  
  const originalTx = await adapter.sendTransaction({
    from: wallet.address,
    to: 'GDESTINATION...',
    amount: '10',
    asset: 'native',
  });

  console.log('Original transaction hash:', originalTx.hash);
  console.log('Original fee:', originalTx.fee);

  // If the transaction is stuck, bump the fee
  // You can provide your own sponsor secret key, or rely on configured Stellar Foundation sponsor
  // Note: sponsorSecretKey should be defined by the user or loaded from secure configuration
  const sponsorSecretKey = process.env.SPONSOR_SECRET_KEY; // Load from environment
  const bumpedTx = await adapter.feeBumpTransaction(
    originalTx.hash,
    '20000', // max fee in stroops (0.002 XLM)
    sponsorSecretKey // optional
  );

  console.log('Fee bumped transaction hash:', bumpedTx.hash);
  console.log('New fee:', bumpedTx.fee);
}

feeBumpExample().catch(console.error);
```

### Using the REST API

```bash
# Send a transaction
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "from": "GSOURCE...",
    "to": "GDESTINATION...",
    "amount": "10",
    "asset": "native"
  }'

# Fee bump the transaction
curl -X POST http://localhost:3000/transactions/TXHASH/fee-bump \
  -H "Content-Type: application/json" \
  -d '{
    "maxFee": "20000",
    "sponsorSecretKey": "SSPONSOR..."
  }'

# Get Stellar Foundation sponsor address for current network
curl http://localhost:3000/sponsor
```

## Configuration

To use Stellar Foundation sponsorship in production:

1. Configure the sponsor secret key via environment variable or secure key management
2. Contact Stellar Foundation for actual sponsor account addresses
3. Update `STELLAR_FOUNDATION_SPONSORS` in `src/types/stellar.ts`

## Important Notes

- Fee bump transactions require the inner transaction to still be pending
- The max fee must be higher than the original transaction fee
- The sponsor account must have sufficient balance to pay the fee
- Current implementation uses placeholder sponsor addresses - replace with actual ones for production
