/**
 * Port for signing backend-issued commands (e.g. a box unlock authorization)
 * with the backend's Ed25519 key. The device holds the matching public key and
 * verifies the signature, so a spoofed or replayed network response cannot force
 * the box open — the decision is server-authoritative.
 */
export interface CommandSigner {
  /** The raw 32-byte Ed25519 public key (hex) devices use to verify commands. */
  readonly publicKeyHex: string;
  /** Returns the Ed25519 signature (hex) over the exact UTF-8 bytes of `message`. */
  sign(message: string): string;
}
