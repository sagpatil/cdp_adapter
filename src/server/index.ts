// REST API server with CDP-compatible endpoints
import express, { Request, Response } from 'express';
import { StellarWalletAdapter } from '../adapter/StellarWalletAdapter';
import type { CDPAdapterConfig, CDPTransactionRequest } from '../types/cdp';

const app = express();
app.use(express.json());

// Default configuration - can be overridden via environment variables
const config: CDPAdapterConfig = {
  network: (process.env.STELLAR_NETWORK as any) || 'testnet',
  horizonUrl: process.env.HORIZON_URL,
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL,
};

const adapter = new StellarWalletAdapter(config);

/**
 * POST /wallets - Create a new wallet
 */
app.post('/wallets', async (req: Request, res: Response) => {
  try {
    const wallet = await adapter.createWallet();
    
    // Include the secret key in the response ONLY if explicitly enabled
    // SECURITY WARNING: Never expose secret keys in production!
    const includeSecretKey = process.env.EXPOSE_SECRET_KEYS === 'true' || process.env.NODE_ENV === 'development';
    const keypair = includeSecretKey ? adapter.getWalletKeypair(wallet.address) : undefined;
    
    const response: any = { wallet };
    if (keypair) {
      response.secretKey = keypair.secretKey;
      response.warning = 'SECRET KEY INCLUDED - Store securely and never share!';
    }
    
    res.status(201).json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /wallets/:address - Get wallet details
 */
app.get('/wallets/:address', async (req: Request, res: Response) => {
  try {
    const wallet = await adapter.getWallet(req.params.address);
    res.json({ wallet });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /wallets/import - Import an existing wallet
 */
app.post('/wallets/import', async (req: Request, res: Response) => {
  try {
    const { secretKey } = req.body;
    
    if (!secretKey) {
      return res.status(400).json({ error: 'secretKey is required' });
    }

    const wallet = await adapter.importWallet(secretKey);
    res.status(201).json({ wallet });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /transactions - Build and submit a transaction
 */
app.post('/transactions', async (req: Request, res: Response) => {
  try {
    const request: CDPTransactionRequest = req.body;
    const transaction = await adapter.sendTransaction(request);
    res.status(201).json({ transaction });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /transactions/:hash - Get transaction status
 */
app.get('/transactions/:hash', async (req: Request, res: Response) => {
  try {
    const transaction = await adapter.getTransaction(req.params.hash);
    res.json({ transaction });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /transactions/:hash/fee-bump - Bump the fee of a pending transaction
 */
app.post('/transactions/:hash/fee-bump', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    const { maxFee, sponsorSecretKey } = req.body;

    if (!maxFee) {
      return res.status(400).json({ error: 'maxFee is required' });
    }

    const transaction = await adapter.feeBumpTransaction(hash, maxFee, sponsorSecretKey);
    res.status(201).json({ transaction });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /sponsor - Get Stellar Foundation sponsor address for current network
 */
app.get('/sponsor', (req: Request, res: Response) => {
  const sponsorAddress = adapter.getStellarFoundationSponsor();
  res.json({
    network: config.network,
    sponsorAddress,
    note: 'This is the Stellar Foundation sponsor account for fee bump transactions',
  });
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    network: config.network,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CDP Stellar Adapter server running on port ${PORT}`);
  console.log(`Network: ${config.network}`);
  console.log(`Horizon URL: ${config.horizonUrl || 'default'}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST   /wallets`);
  console.log(`  GET    /wallets/:address`);
  console.log(`  POST   /wallets/import`);
  console.log(`  POST   /transactions`);
  console.log(`  GET    /transactions/:hash`);
  console.log(`  POST   /transactions/:hash/fee-bump`);
  console.log(`  GET    /sponsor`);
  console.log(`  GET    /health`);
});

export default app;
