import { Signer } from '../src/adapter/Signer';

describe('Signer', () => {
  let signer: Signer;

  beforeEach(() => {
    signer = new Signer();
  });

  describe('generateKeypair', () => {
    it('should generate a valid keypair', () => {
      const keypair = signer.generateKeypair();
      
      expect(keypair.publicKey).toBeDefined();
      expect(keypair.secretKey).toBeDefined();
      expect(keypair.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
      expect(keypair.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
    });

    it('should generate unique keypairs', () => {
      const keypair1 = signer.generateKeypair();
      const keypair2 = signer.generateKeypair();
      
      expect(keypair1.publicKey).not.toBe(keypair2.publicKey);
      expect(keypair1.secretKey).not.toBe(keypair2.secretKey);
    });
  });

  describe('getPublicKey', () => {
    it('should derive public key from secret key', () => {
      const keypair = signer.generateKeypair();
      const derivedPublicKey = signer.getPublicKey(keypair.secretKey);
      
      expect(derivedPublicKey).toBe(keypair.publicKey);
    });
  });

  describe('loadKeypair', () => {
    it('should load keypair from secret key', () => {
      const originalKeypair = signer.generateKeypair();
      const loadedKeypair = signer.loadKeypair(originalKeypair.secretKey);
      
      expect(loadedKeypair.publicKey()).toBe(originalKeypair.publicKey);
    });
  });
});
