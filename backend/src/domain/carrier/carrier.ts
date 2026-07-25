import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** A carrier (carrier) responsible for moving cold-chain shipments. */
export interface Carrier {
  readonly id: string;
  readonly name: string;
  /** EVM address that receives the escrow payout. */
  readonly walletAddress: string | null;
}

export interface CreateCarrierProps {
  name: string;
  walletAddress?: string;
}

/**
 * Factory that enforces the carrier invariants. Construction is the only
 * way to get a Carrier, so an instance is always valid.
 */
export function createCarrier(
  props: CreateCarrierProps
): Carrier {
  const name = props.name?.trim();
  if (!name) {
    throw new ValidationError("name is required");
  }

  const walletAddress = props.walletAddress?.trim() || null;
  if (walletAddress && !EVM_ADDRESS.test(walletAddress)) {
    throw new ValidationError(
      "walletAddress must be a 20-byte EVM address"
    );
  }

  return {
    id: randomUUID(),
    name,
    walletAddress,
  };
}
