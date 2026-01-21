import { StellarWalletAdapter } from '../src/adapter/StellarWalletAdapter';
import type { CDPAdapterConfig } from '../src/types/cdp';

describe('StellarWalletAdapter', () => {
  let adapter: StellarWalletAdapter;
  let config: CDPAdapterConfig;

  beforeEach(() => {
    config = {
      network: 'testnet',
    };
    adapter = new StellarWalletAdapter(config);
  });

  describe('createWallet', () => {
    it('should create a new wallet', async () => {
      const wallet = await adapter.createWallet();
      
      expect(wallet).toBeDefined();
      expect(wallet.id).toMatch(/^wallet_/);
      expect(wallet.address).toMatch(/^G[A-Z0-9]{55}$/);
      expect(wallet.network).toBe('testnet');
      expect(wallet.createdAt).toBeDefined();
    });

    it('should create unique wallets', async () => {
      const wallet1 = await adapter.createWallet();
      const wallet2 = await adapter.createWallet();
      
      expect(wallet1.id).not.toBe(wallet2.id);
      expect(wallet1.address).not.toBe(wallet2.address);
    });
  });

  describe('getWallet', () => {
    it('should retrieve a created wallet', async () => {
      const created = await adapter.createWallet();
      const retrieved = await adapter.getWallet(created.address);
      
      expect(retrieved).toEqual(created);
    });

    it('should throw error for non-existent wallet', async () => {
      await expect(
        adapter.getWallet('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      ).rejects.toThrow('Wallet not found');
    });
  });

  describe('importWallet', () => {
    it('should import wallet from secret key', async () => {
      const created = await adapter.createWallet();
      const keypair = adapter.getWalletKeypair(created.address);
      
      if (!keypair) {
        throw new Error('Keypair not found');
      }

      const imported = await adapter.importWallet(keypair.secretKey);
      
      expect(imported.address).toBe(created.address);
      expect(imported.network).toBe('testnet');
    });
  });

  describe('getStellarFoundationSponsor', () => {
    it('should return sponsor address for testnet (empty if not configured)', () => {
      const sponsor = adapter.getStellarFoundationSponsor();
      
      expect(sponsor).toBeDefined();
      expect(typeof sponsor).toBe('string');
      // Sponsor addresses are configured via environment variables
      // When not configured, returns empty string
      if (sponsor) {
        expect(sponsor).toMatch(/^G[A-Z0-9]{55}$/);
      }
    });

    it('should return sponsor addresses for all networks (empty if not configured)', () => {
      const testnetAdapter = new StellarWalletAdapter({ network: 'testnet' });
      const mainnetAdapter = new StellarWalletAdapter({ network: 'mainnet' });
      const futurenetAdapter = new StellarWalletAdapter({ network: 'futurenet' });
      
      const testnetSponsor = testnetAdapter.getStellarFoundationSponsor();
      const mainnetSponsor = mainnetAdapter.getStellarFoundationSponsor();
      const futurenetSponsor = futurenetAdapter.getStellarFoundationSponsor();
      
      // All sponsors should be strings (empty if not configured via env vars)
      expect(typeof testnetSponsor).toBe('string');
      expect(typeof mainnetSponsor).toBe('string');
      expect(typeof futurenetSponsor).toBe('string');
      
      // If configured, they should be valid Stellar addresses
      if (testnetSponsor) expect(testnetSponsor).toMatch(/^G[A-Z0-9]{55}$/);
      if (mainnetSponsor) expect(mainnetSponsor).toMatch(/^G[A-Z0-9]{55}$/);
      if (futurenetSponsor) expect(futurenetSponsor).toMatch(/^G[A-Z0-9]{55}$/);
    });
  });
});
