import { z } from "zod";
import type { Reading } from "../../domain/reading/reading.js";
import { createReading } from "../../domain/reading/reading.js";
import type { ReadingRepository } from "../../domain/reading/reading-repository.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { FinishDelivery } from "../delivery/finish-delivery.js";
import type { SignatureVerifier } from "../ports/signature-verifier.js";
import type {
  ConsensusLog,
  ConsensusReceipt,
} from "../ports/consensus-log.js";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../shared/errors.js";

/** The signed envelope a sensor device POSTs to `/readings`. */
export interface IngestReadingInput {
  message: string;
  publicKey: string;
  signature: string;
}

/** The persisted reading plus its consensus-log receipt, if it was mirrored. */
export interface IngestReadingResult {
  reading: Reading;
  consensus: ConsensusReceipt | null;
}

/** Cold-chain range used to detect a breach on ingest. */
export interface BreachRange {
  minTempC: number;
  maxTempC: number;
}

/** Schema of the canonical reading JSON the device signs (see firmware). */
const messageSchema = z.object({
  deviceId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  temperatureC: z.number().finite(),
  unit: z.string().min(1),
  ts: z.number().nonnegative(),
});

/**
 * Ingests a signed temperature reading from a sensor device. The reading is
 * authenticated by its Ed25519 signature (no bearer token) and authorized by
 * matching the signing key to a registered, non-revoked device.
 */
export class IngestReading {
  constructor(
    private readonly readings: ReadingRepository,
    private readonly devices: DeviceRepository,
    private readonly deliveries: DeliveryRepository,
    private readonly verifier: SignatureVerifier,
    private readonly consensusLog: ConsensusLog,
    private readonly finisher: FinishDelivery,
    private readonly range: BreachRange
  ) {}

  async execute(input: IngestReadingInput): Promise<IngestReadingResult> {
    const publicKey = input.publicKey?.trim().toLowerCase();
    const signature = input.signature?.trim().toLowerCase();

    if (!input.message || !publicKey || !signature) {
      throw new ValidationError(
        "expected { message, publicKey, signature }"
      );
    }

    // 1. Authenticate: the signature must cover the exact message bytes.
    if (!this.verifier.verify(input.message, publicKey, signature)) {
      throw new UnauthorizedError("invalid reading signature");
    }

    // 2. Parse the signed reading payload.
    let payload: unknown;
    try {
      payload = JSON.parse(input.message);
    } catch {
      throw new ValidationError("message is not valid JSON");
    }
    const parsed = messageSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ")
      );
    }

    // 3. Authorize: the signing key must belong to the registered device.
    const device = await this.devices.findByDeviceId(parsed.data.deviceId);
    if (!device) {
      throw new ForbiddenError(
        `device '${parsed.data.deviceId}' is not registered`
      );
    }
    if (device.publicKey !== publicKey) {
      throw new ForbiddenError(
        `signing key does not match registered device '${parsed.data.deviceId}'`
      );
    }
    if (device.status === "revoked") {
      throw new ForbiddenError(
        `device '${parsed.data.deviceId}' is revoked`
      );
    }

    const reading = createReading({
      ...parsed.data,
      publicKey,
      signature,
    });
    await this.readings.save(reading);

    // 4. A reading outside the cold-chain range ends the trip: finalize the
    //    device's in-transit delivery (which settles the escrow as a refund).
    await this.finalizeOnBreach(device.deviceId, reading.temperatureC);

    // 5. Mirror the authenticated reading to the immutable consensus log.
    //    Best-effort: a null receipt means it was not committed to HCS.
    const consensus = await this.consensusLog.publish(reading);
    return { reading, consensus };
  }

  /**
   * Finalizes the device's in-transit delivery when a reading breaches the
   * cold-chain range. Best-effort: a no-op when the reading is in range or the
   * device has no in-transit delivery.
   */
  private async finalizeOnBreach(
    deviceId: string,
    temperatureC: number
  ): Promise<void> {
    const inRange =
      temperatureC >= this.range.minTempC &&
      temperatureC <= this.range.maxTempC;
    if (inRange) {
      return;
    }
    const all = await this.deliveries.list();
    const active = all.find(
      (d) => d.deviceId === deviceId && d.status === "in_transit"
    );
    if (!active) {
      return;
    }
    await this.finisher.execute(active.id);
  }
}
