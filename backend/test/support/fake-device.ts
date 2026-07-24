import { generateKeyPairSync, sign as edSign, type KeyObject } from "node:crypto";

/** Length of the fixed Ed25519 SPKI (DER) header that wraps the raw 32-byte key. */
const ED25519_SPKI_PREFIX_LEN = 12;

/** The signed envelope a device POSTs to `/readings`. */
export interface ReadingEnvelope {
  message: string;
  publicKey: string;
  signature: string;
}

export interface ReadingFields {
  seq: number;
  temperatureC: number;
  ts?: number;
}

/**
 * A software stand-in for the ESP32 firmware. It owns an Ed25519 key pair and
 * reproduces the exact canonical message and signed envelope the real device
 * sends, so the backend's registration, signature verification and readings
 * ingestion can be exercised without physical hardware.
 */
export class FakeDevice {
  readonly deviceId: string;
  readonly publicKeyHex: string;
  private readonly privateKey: KeyObject;
  private seq = 0;

  constructor(deviceId = `fake-${Date.now()}`) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    this.deviceId = deviceId;
    this.privateKey = privateKey;
    // Strip the 12-byte SPKI header to get the raw 32-byte key the firmware sends.
    const spki = Buffer.from(publicKey.export({ type: "spki", format: "der" }));
    this.publicKeyHex = spki.subarray(ED25519_SPKI_PREFIX_LEN).toString("hex");
  }

  /**
   * Builds the canonical reading string byte-for-byte like the firmware
   * (`firmware/src/main.cpp`): fixed key order and `temperatureC` to 2 decimals.
   * These exact bytes are what gets signed.
   */
  buildMessage(fields: ReadingFields): string {
    const ts = fields.ts ?? Math.floor(Date.now() / 1000);
    return (
      `{"deviceId":"${this.deviceId}",` +
      `"seq":${fields.seq},` +
      `"temperatureC":${fields.temperatureC.toFixed(2)},` +
      `"unit":"C",` +
      `"ts":${ts}}`
    );
  }

  /** Signs the exact message bytes and returns the signed envelope. */
  sign(message: string): ReadingEnvelope {
    const signature = edSign(null, Buffer.from(message, "utf8"), this.privateKey);
    return {
      message,
      publicKey: this.publicKeyHex,
      signature: signature.toString("hex"),
    };
  }

  /** Produces the next signed reading, auto-incrementing the sequence number. */
  nextReading(temperatureC: number, ts?: number): ReadingEnvelope {
    this.seq += 1;
    return this.sign(this.buildMessage({ seq: this.seq, temperatureC, ts }));
  }
}
