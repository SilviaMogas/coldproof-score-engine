import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

/** A delivery is `ready` on creation, `in_transit` once started, then `finished` (which frees its device). */
export type DeliveryStatus = "ready" | "in_transit" | "finished";

/**
 * Lifecycle of the Sepolia ETH escrow tied to a delivery:
 * - `disabled`        : no escrow (amount 0, or settlement not configured)
 * - `awaiting_escrow` : created; waiting for the escrow account to be funded
 * - `escrowed`        : funds confirmed; the delivery may start
 * - `released`        : cold chain held; paid out to the carrier
 * - `refunded`        : breach (or unverifiable); refunded to the shipper
 * - `unsettled`       : finished but the transfer could not be completed
 */
export type SettlementStatus =
  | "disabled"
  | "awaiting_escrow"
  | "escrowed"
  | "released"
  | "refunded"
  | "unsettled";

/** Outcome of settling a delivery from the Sepolia escrow state. */
export interface SettlementResult {
  verdict: "released" | "refunded" | "unsettled";
  /** Human-readable explanation of the verdict. */
  reason: string;
  /** Number of readings recorded by the contract. */
  totalReadings: number;
  /** How many of those readings were out of range. */
  violations: number;
  minTempC: number | null;
  maxTempC: number | null;
  /** Account the funds moved to, or null if no transfer happened. */
  paidTo: string | null;
  amountEth: number;
  transactionId: string | null;
  settledAt: string;
}

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
  /** ETH held in escrow and released on a compliant delivery. */
  readonly amountEth: number;
  readonly settlementStatus: SettlementStatus;
  readonly settlement: SettlementResult | null;
  readonly createdAt: Date;
}

export interface CreateDeliveryProps {
  from: string;
  to: string;
  boxContents: string;
  deviceId: string;
  carrierId: string;
  /** Amount to hold in escrow (ETH). 0 means no settlement for this delivery. */
  amountEth?: number;
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
  const amountEth = props.amountEth ?? 0;

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
  if (!Number.isFinite(amountEth) || amountEth < 0) {
    throw new ValidationError("amountEth must be a non-negative number");
  }

  return {
    id: randomUUID(),
    from,
    to,
    boxContents,
    deviceId,
    carrierId,
    status: "ready",
    amountEth,
    settlementStatus: amountEth > 0 ? "awaiting_escrow" : "disabled",
    settlement: null,
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
  if (delivery.settlementStatus === "awaiting_escrow") {
    throw new ValidationError(
      `delivery '${delivery.id}' cannot start until its escrow is funded`
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

/** Confirms the escrow is funded, moving it from `awaiting_escrow` to `escrowed`. */
export function markEscrowed(delivery: Delivery): Delivery {
  if (delivery.settlementStatus !== "awaiting_escrow") {
    throw new ValidationError(
      `delivery '${delivery.id}' is not awaiting escrow (settlement: ${delivery.settlementStatus})`
    );
  }
  return { ...delivery, settlementStatus: "escrowed" };
}

/** Records the settlement outcome on a delivery. */
export function applySettlement(
  delivery: Delivery,
  result: SettlementResult
): Delivery {
  return {
    ...delivery,
    settlementStatus: result.verdict,
    settlement: result,
  };
}
