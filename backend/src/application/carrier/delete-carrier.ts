import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";
import { NotFoundError } from "../../shared/errors.js";

/** Deletes a registered carrier. Fails if it does not exist. */
export class DeleteCarrier {
  constructor(private readonly carriers: CarrierRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.carriers.findById(id.trim());
    if (!existing) {
      throw new NotFoundError(`carrier '${id}' not found`);
    }
    await this.carriers.delete(existing.id);
  }
}
