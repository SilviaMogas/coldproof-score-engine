import type { Delivery } from "./delivery.js";

export interface DeliveryRepository {
  save(delivery: Delivery): Promise<void>;
  findById(id: string): Promise<Delivery | null>;
  findByDeviceId(deviceId: string): Promise<Delivery | null>;
  list(): Promise<Delivery[]>;
  delete(id: string): Promise<void>;
}
