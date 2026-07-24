import type { Carrier } from "../../domain/carrier/carrier.js";
import { createCarrier } from "../../domain/carrier/carrier.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";

export interface RegisterCarrierInput {
  name: string;
}

/** Registers a new carrier. */
export class RegisterCarrier {
  constructor(private readonly carriers: CarrierRepository) {}

  async execute(input: RegisterCarrierInput): Promise<Carrier> {
    const carrier = createCarrier(input);
    await this.carriers.save(carrier);
    return carrier;
  }
}
