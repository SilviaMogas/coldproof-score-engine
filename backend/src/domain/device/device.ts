import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

export type DeviceStatus = "active" | "revoked";

/**
 * A registered sensor device in the backoffice. Its Ed25519 public key is what
 * the ingestion gateway uses to authenticate signed readings.
 */
export interface Device {
  readonly id: string;
  readonly deviceId: string;
  readonly publicKey: string;
  readonly label: string;
  readonly status: DeviceStatus;
  readonly createdAt: Date;
}

export interface CreateDeviceProps {
  deviceId: string;
  publicKey: string;
  label: string;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

/**
 * Factory that enforces the device invariants. Construction is the only way to
 * get a Device, so an instance is always valid.
 */
export function createDevice(props: CreateDeviceProps): Device {
  const deviceId = props.deviceId?.trim();
  const label = props.label?.trim();
  const publicKey = props.publicKey?.trim().toLowerCase();

  if (!deviceId) {
    throw new ValidationError("deviceId is required");
  }
  if (!label) {
    throw new ValidationError("label is required");
  }
  if (!publicKey || !HEX_64.test(publicKey)) {
    throw new ValidationError(
      "publicKey must be a 64-character hex Ed25519 public key"
    );
  }

  return {
    id: randomUUID(),
    deviceId,
    publicKey,
    label,
    status: "active",
    createdAt: new Date(),
  };
}
