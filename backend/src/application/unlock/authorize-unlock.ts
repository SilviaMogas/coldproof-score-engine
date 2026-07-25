import { z } from "zod";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { ReadingRepository } from "../../domain/reading/reading-repository.js";
import type { SignatureVerifier } from "../ports/signature-verifier.js";
import type { CommandSigner } from "../ports/command-signer.js";
import type { FinishDelivery } from "../delivery/finish-delivery.js";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../shared/errors.js";

/** The signed envelope a device POSTs to `/unlock` to request door access. */
export interface AuthorizeUnlockInput {
  message: string;
  publicKey: string;
  signature: string;
}

/** Why an unlock request was denied (the request itself was valid). */
export type UnlockDenyReason = "no_active_delivery" | "temperature_breach";

export type UnlockDecision =
  | {
      authorized: true;
      /** Canonical JSON the device must verify against `publicKey`. */
      command: string;
      /** Ed25519 signature (hex) of `command`, from the backend key. */
      signature: string;
      /** Backend public key (hex) the device uses to verify `command`. */
      publicKey: string;
      /** ISO timestamp after which the command is no longer valid. */
      expiresAt: string;
    }
  | { authorized: false; reason: UnlockDenyReason };

/** Cold-chain range and command lifetime used to decide an unlock. */
export interface UnlockPolicy {
  minTempC: number;
  maxTempC: number;
  ttlSeconds: number;
}

/** Schema of the canonical request the device signs. */
const messageSchema = z.object({
  deviceId: z.string().min(1),
  nonce: z.string().min(1).max(128),
  ts: z.number().nonnegative(),
});
const MAX_REQUEST_AGE_SECONDS = 300;
const MAX_FUTURE_SKEW_SECONDS = 60;

/**
 * Server-authoritative unlock authorization for the secure box.
 *
 * The device authenticates the request with its own Ed25519 signature (same as
 * readings). The box is only allowed to open when the device has a delivery in
 * transit AND no reading in that window breached the temperature range. On
 * approval the backend returns a short-lived command signed with its own key,
 * which the device verifies before driving the latch — so a spoofed or replayed
 * response cannot force the box open.
 */
export class AuthorizeUnlock {
  private readonly usedRequests = new Set<string>();

  constructor(
    private readonly devices: DeviceRepository,
    private readonly deliveries: DeliveryRepository,
    private readonly readings: ReadingRepository,
    private readonly verifier: SignatureVerifier,
    private readonly signer: CommandSigner,
    private readonly policy: UnlockPolicy,
    private readonly finisher: FinishDelivery
  ) {}

  /** The backend public key devices use to verify unlock commands. */
  get publicKey(): string {
    return this.signer.publicKeyHex;
  }

  async execute(input: AuthorizeUnlockInput): Promise<UnlockDecision> {
    const publicKey = input.publicKey?.trim().toLowerCase();
    const signature = input.signature?.trim().toLowerCase();

    if (!input.message || !publicKey || !signature) {
      throw new ValidationError("expected { message, publicKey, signature }");
    }

    // 1. Authenticate: the signature must cover the exact message bytes.
    if (!this.verifier.verify(input.message, publicKey, signature)) {
      throw new UnauthorizedError("invalid unlock request signature");
    }

    // 2. Parse and validate the signed request.
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

    // 3. Authorize the identity: the signing key must belong to the device.
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
      throw new ForbiddenError(`device '${parsed.data.deviceId}' is revoked`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (
      parsed.data.ts < now - MAX_REQUEST_AGE_SECONDS ||
      parsed.data.ts > now + MAX_FUTURE_SKEW_SECONDS
    ) {
      throw new UnauthorizedError("unlock request timestamp is stale");
    }
    const requestId = `${device.deviceId}:${parsed.data.nonce}`;
    if (this.usedRequests.has(requestId)) {
      throw new UnauthorizedError("unlock request was already used");
    }
    this.usedRequests.add(requestId);

    // 4. The box may only open for a delivery that is in transit.
    const all = await this.deliveries.list();
    const delivery = all.find(
      (d) => d.deviceId === device.deviceId && d.status === "in_transit"
    );
    if (!delivery) {
      return { authorized: false, reason: "no_active_delivery" };
    }

    // 5. Refuse if any reading in this delivery breached the temperature range.
    const readings = await this.readings.listByDeviceId(device.deviceId);
    const breached = readings.some(
      (r) =>
        r.receivedAt >= delivery.createdAt &&
        (r.temperatureC < this.policy.minTempC ||
          r.temperatureC > this.policy.maxTempC)
    );
    if (breached) {
      return { authorized: false, reason: "temperature_breach" };
    }

    // 6. Approve: issue a short-lived, backend-signed unlock command.
    const exp = Math.floor(Date.now() / 1000) + this.policy.ttlSeconds;
    const command = JSON.stringify({
      deviceId: device.deviceId,
      deliveryId: delivery.id,
      nonce: parsed.data.nonce,
      action: "unlock",
      exp,
    });

    // 7. The box is being opened at its destination, so the trip is done:
    //    finalize the delivery (frees the device and settles the escrow).
    await this.finisher.execute(delivery.id);

    return {
      authorized: true,
      command,
      signature: this.signer.sign(command),
      publicKey: this.signer.publicKeyHex,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }
}
