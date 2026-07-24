import type { Delivery } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";

/** In-memory delivery store. Swap for a durable adapter without touching callers. */
export class InMemoryDeliveryRepository implements DeliveryRepository {
  private readonly store = new Map<string, Delivery>();

  async save(delivery: Delivery): Promise<void> {
    this.store.set(delivery.id, delivery);
  }

  async findById(id: string): Promise<Delivery | null> {
    return this.store.get(id) ?? null;
  }

  async findByDeviceId(deviceId: string): Promise<Delivery | null> {
    for (const delivery of this.store.values()) {
      if (delivery.deviceId === deviceId) {
        return delivery;
      }
    }
    return null;
  }

  async list(): Promise<Delivery[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
