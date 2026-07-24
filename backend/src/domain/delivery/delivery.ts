import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

/** A delivery is `ready` on creation, `in_transit` once started, then `finished` (which frees its device). */
export type DeliveryStatus = "ready" | "in_transit" | "finished";

/**
 * A shipment of a box, tracked by a sensor device and moved by a carrier.
 * A device can be assigned to at most one in-transit delivery (it is "in use"
 * until the delivery is finished).
 */
export interface Delivery {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly boxContents: string;
  readonly deviceId: string;
  readonly carrierId: string;
  readonly status: DeliveryStatus;
  readonly createdAt: Date;
}

export interface CreateDeliveryProps {
  from: string;
  to: string;
  boxContents: string;
  deviceId: string;
  carrierId: string;
}

/**
 * Factory that enforces the delivery invariants. Construction is the only way
 * to get a Delivery, so an instance is always valid.
 */
export function createDelivery(props: CreateDeliveryProps): Delivery {
  const from = props.from?.trim();
  const to = props.to?.trim();
  const boxContents = props.boxContents?.trim();
  const deviceId = props.deviceId?.trim();
  const carrierId = props.carrierId?.trim();

  if (!from) {
    throw new ValidationError("from is required");
  }
  if (!to) {
    throw new ValidationError("to is required");
  }
  if (!boxContents) {
    throw new ValidationError("boxContents is required");
  }
  if (!deviceId) {
    throw new ValidationError("deviceId is required");
  }
  if (!carrierId) {
    throw new ValidationError("carrierId is required");
  }

  return {
    id: randomUUID(),
    from,
    to,
    boxContents,
    deviceId,
    carrierId,
    status: "ready",
    createdAt: new Date(),
  };
}

/** Starts a delivery, moving it from `ready` to `in_transit`. */
export function startDelivery(delivery: Delivery): Delivery {
  if (delivery.status !== "ready") {
    throw new ValidationError(
      `delivery '${delivery.id}' cannot be started (status: ${delivery.status})`
    );
  }
  return { ...delivery, status: "in_transit" };
}

/** Marks an in-transit delivery as finished. Fails if it is not in transit. */
export function finishDelivery(delivery: Delivery): Delivery {
  if (delivery.status !== "in_transit") {
    throw new ValidationError(
      `delivery '${delivery.id}' cannot be finished (status: ${delivery.status})`
    );
  }
  return { ...delivery, status: "finished" };
}
