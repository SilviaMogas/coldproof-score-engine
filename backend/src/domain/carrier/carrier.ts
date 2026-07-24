import { randomUUID } from "node:crypto";
import { ValidationError } from "../../shared/errors.js";

/** A carrier (carrier) responsible for moving cold-chain shipments. */
export interface Carrier {
  readonly id: string;
  readonly name: string;
}

export interface CreateCarrierProps {
  name: string;
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

  return {
    id: randomUUID(),
    name,
  };
}
