import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

/** Matches a Hedera account id such as "0.0.1234". */
const HEDERA_ACCOUNT_ID = /^\d+\.\d+\.\d+$/;

/** A carrier (carrier) responsible for moving cold-chain shipments. */
export interface Carrier {
  readonly id: string;
  readonly name: string;
  /** Hedera account that receives the escrow payout when a delivery settles. */
  readonly hederaAccountId: string | null;
}

export interface CreateCarrierProps {
  name: string;
  hederaAccountId?: string;
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

  const hederaAccountId = props.hederaAccountId?.trim() || null;
  if (hederaAccountId && !HEDERA_ACCOUNT_ID.test(hederaAccountId)) {
    throw new ValidationError(
      "hederaAccountId must look like a Hedera account id (e.g. 0.0.1234)"
    );
  }

  return {
    id: randomUUID(),
    name,
    hederaAccountId,
  };
}
