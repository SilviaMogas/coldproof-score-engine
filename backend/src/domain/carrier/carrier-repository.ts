import type { Carrier } from "./carrier.js";

export interface CarrierRepository {
  save(carrier: Carrier): Promise<void>;
  findById(id: string): Promise<Carrier | null>;
  list(): Promise<Carrier[]>;
  delete(id: string): Promise<void>;
}
