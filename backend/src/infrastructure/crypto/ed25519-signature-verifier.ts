import { createPublicKey, verify } from "node:crypto";
import type { SignatureVerifier } from "../../application/ports/signature-verifier.js";

/**
 * Ed25519 signature verification for readings coming from the ESP32 devices.
 *
 * The device sends a raw 32-byte public key and 64-byte signature (both hex).
 * Node's crypto needs the public key wrapped in DER (SPKI) form, so we prepend
 * the fixed Ed25519 SPKI header to the raw key bytes.
 */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export class Ed25519SignatureVerifier implements SignatureVerifier {
  verify(message: string, publicKeyHex: string, signatureHex: string): boolean {
    try {
      const raw = Buffer.from(publicKeyHex, "hex");
      if (raw.length !== 32) {
        return false;
      }
      const key = createPublicKey({
        key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
        format: "der",
        type: "spki",
      });
      return verify(
        null,
        Buffer.from(message, "utf8"),
        key,
        Buffer.from(signatureHex, "hex")
      );
    } catch {
      return false;
    }
  }
}
