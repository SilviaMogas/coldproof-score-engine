import type { Carrier } from "../../domain/carrier/carrier.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";

/** Lists all registered carriers. */
export class ListCarriers {
  constructor(private readonly carriers: CarrierRepository) {}

  execute(): Promise<Carrier[]> {
    return this.carriers.list();
  }
}
