import type { Carrier } from "../../domain/carrier/carrier.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";

/** In-memory carrier store. Swap for a durable adapter without touching callers. */
export class InMemoryCarrierRepository
  implements CarrierRepository
{
  private readonly store = new Map<string, Carrier>();

  async save(carrier: Carrier): Promise<void> {
    this.store.set(carrier.id, carrier);
  }

  async findById(id: string): Promise<Carrier | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<Carrier[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
