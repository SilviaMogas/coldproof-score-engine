/**
 * Port for verifying an Ed25519 signature over a message. Implemented in
 * infrastructure (Node crypto). Kept independent of any crypto library so the
 * application layer stays framework-free.
 */
export interface SignatureVerifier {
  /**
   * Returns true when `signatureHex` is a valid Ed25519 signature of the exact
   * UTF-8 bytes of `message` under the raw 32-byte public key `publicKeyHex`.
   * Never throws on a malformed signature or key.
   */
  verify(message: string, publicKeyHex: string, signatureHex: string): boolean;
}
