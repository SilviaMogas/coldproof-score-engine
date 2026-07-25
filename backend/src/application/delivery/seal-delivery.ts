import { z } from "zod";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import { startDelivery } from "../../domain/delivery/delivery.js";
import type { SignatureVerifier } from "../ports/signature-verifier.js";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../shared/errors.js";

/** The signed envelope a device POSTs to `/seal` when it locks the box. */
export interface SealDeliveryInput {
  message: string;
  publicKey: string;
  signature: string;
}

/** Why a seal request did not start a delivery (the request itself was valid). */
export type SealDenyReason = "no_ready_delivery" | "escrow_unfunded";

export type SealDecision =
  | { sealed: true; deliveryId: string }
  | { sealed: false; reason: SealDenyReason };

/** Schema of the canonical request the device signs (same shape as unlock). */
const messageSchema = z.object({
  deviceId: z.string().min(1),
  nonce: z.string().min(1).max(128),
  ts: z.number().nonnegative(),
});

/**
 * Starts a delivery when the box is physically sealed in the field.
 *
 * The device authenticates the request with its own Ed25519 signature (like
 * `/readings` and `/unlock`, no bearer token). On a valid request the device's
 * `ready` delivery is moved to `in_transit`. This replaces the operator's manual
 * "Start" click: closing the door and pressing the button once starts the trip.
 */
export class SealDelivery {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly deliveries: DeliveryRepository,
    private readonly verifier: SignatureVerifier
  ) {}

  async execute(input: SealDeliveryInput): Promise<SealDecision> {
    const publicKey = input.publicKey?.trim().toLowerCase();
    const signature = input.signature?.trim().toLowerCase();

    if (!input.message || !publicKey || !signature) {
      throw new ValidationError("expected { message, publicKey, signature }");
    }

    // 1. Authenticate: the signature must cover the exact message bytes.
    if (!this.verifier.verify(input.message, publicKey, signature)) {
      throw new UnauthorizedError("invalid seal request signature");
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

    // 4. Find the device's delivery. Sealing again once in transit is a no-op.
    const all = await this.deliveries.list();
    const active = all.find(
      (d) => d.deviceId === device.deviceId && d.status === "in_transit"
    );
    if (active) {
      return { sealed: true, deliveryId: active.id };
    }
    const ready = all.find(
      (d) => d.deviceId === device.deviceId && d.status === "ready"
    );
    if (!ready) {
      return { sealed: false, reason: "no_ready_delivery" };
    }
    if (ready.settlementStatus === "awaiting_escrow") {
      return { sealed: false, reason: "escrow_unfunded" };
    }

    // 5. Start the trip.
    const started = startDelivery(ready);
    await this.deliveries.save(started);
    return { sealed: true, deliveryId: started.id };
  }
}
