// Signer - Handles Stellar keypair management and transaction signing
import { Keypair, Transaction } from '@stellar/stellar-sdk';
import type { StellarKeypair } from '../types/stellar';

export class Signer {
  /**
   * Generate a new random Ed25519 keypair
   */
  generateKeypair(): StellarKeypair {
    const keypair = Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  /**
   * Load a keypair from a secret key
   */
  loadKeypair(secretKey: string): Keypair {
    return Keypair.fromSecret(secretKey);
  }

  /**
   * Sign a Stellar transaction
   */
  signTransaction(transaction: Transaction, secretKey: string): Transaction {
    const keypair = this.loadKeypair(secretKey);
    transaction.sign(keypair);
    return transaction;
  }

  /**
   * Get public key from secret key
   */
  getPublicKey(secretKey: string): string {
    const keypair = this.loadKeypair(secretKey);
    return keypair.publicKey();
  }
}
