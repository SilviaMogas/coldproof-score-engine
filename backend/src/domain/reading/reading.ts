import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

/**
 * A temperature reading uploaded by a sensor device. It is stored only after
 * its Ed25519 signature has been verified against a registered device, so a
 * persisted reading is always authentic.
 */
export interface Reading {
  readonly id: string;
  readonly deviceId: string;
  readonly seq: number;
  readonly temperatureC: number;
  readonly unit: string;
  readonly ts: number;
  readonly publicKey: string;
  readonly signature: string;
  readonly receivedAt: Date;
}

export interface CreateReadingProps {
  deviceId: string;
  seq: number;
  temperatureC: number;
  unit: string;
  ts: number;
  publicKey: string;
  signature: string;
}

/**
 * Factory that enforces the reading invariants. Construction is the only way to
 * get a Reading, so an instance is always valid.
 */
export function createReading(props: CreateReadingProps): Reading {
  const deviceId = props.deviceId?.trim();
  const unit = props.unit?.trim();
  const publicKey = props.publicKey?.trim().toLowerCase();
  const signature = props.signature?.trim().toLowerCase();

  if (!deviceId) {
    throw new ValidationError("deviceId is required");
  }
  if (!Number.isFinite(props.temperatureC)) {
    throw new ValidationError("temperatureC must be a finite number");
  }
  if (!unit) {
    throw new ValidationError("unit is required");
  }
  if (!Number.isInteger(props.seq) || props.seq < 0) {
    throw new ValidationError("seq must be a non-negative integer");
  }
  if (!Number.isFinite(props.ts) || props.ts < 0) {
    throw new ValidationError("ts must be a non-negative number");
  }
  if (!publicKey) {
    throw new ValidationError("publicKey is required");
  }
  if (!signature) {
    throw new ValidationError("signature is required");
  }

  return {
    id: randomUUID(),
    deviceId,
    seq: props.seq,
    temperatureC: props.temperatureC,
    unit,
    ts: props.ts,
    publicKey,
    signature,
    receivedAt: new Date(),
  };
}
