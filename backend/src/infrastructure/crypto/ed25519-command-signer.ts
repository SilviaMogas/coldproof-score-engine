import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  type KeyObject,
} from "node:crypto";
import type { CommandSigner } from "../../application/ports/command-signer.js";

/**
 * Ed25519 command signer, mirroring the device-side crypto. The backend signs
 * unlock authorizations; devices verify them with the public key exposed here.
 *
 * A raw 32-byte private seed is wrapped in the fixed Ed25519 PKCS8 (DER) header
 * so Node's crypto can load it; the public key is exported as the raw 32 bytes
 * the firmware expects (SPKI export minus its 12-byte header).
 */
const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex"
);
const ED25519_SPKI_PREFIX_LEN = 12;

export class Ed25519CommandSigner implements CommandSigner {
  readonly publicKeyHex: string;
  private readonly privateKey: KeyObject;

  /**
   * @param seedHex optional 32-byte (64 hex chars) Ed25519 seed. When omitted a
   * fresh ephemeral key is generated (dev only — it changes on every restart).
   */
  constructor(seedHex?: string) {
    let privateKey: KeyObject;
    let publicKey: KeyObject;

    if (seedHex) {
      const seed = Buffer.from(seedHex, "hex");
      if (seed.length !== 32) {
        throw new Error(
          "UNLOCK_SIGNING_KEY must be a 32-byte (64 hex chars) Ed25519 seed"
        );
      }
      privateKey = createPrivateKey({
        key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
        format: "der",
        type: "pkcs8",
      });
      publicKey = createPublicKey(privateKey);
    } else {
      const pair = generateKeyPairSync("ed25519");
      privateKey = pair.privateKey;
      publicKey = pair.publicKey;
    }

    this.privateKey = privateKey;
    const spki = Buffer.from(publicKey.export({ type: "spki", format: "der" }));
    this.publicKeyHex = spki.subarray(ED25519_SPKI_PREFIX_LEN).toString("hex");
  }

  sign(message: string): string {
    return edSign(null, Buffer.from(message, "utf8"), this.privateKey).toString(
      "hex"
    );
  }
}
