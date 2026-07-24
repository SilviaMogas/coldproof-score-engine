import type { Env } from "../config/env.js";
import type { DeviceRepository } from "../domain/device/device-repository.js";
import type { CarrierRepository } from "../domain/carrier/carrier-repository.js";
import type { DeliveryRepository } from "../domain/delivery/delivery-repository.js";
import type { ReadingRepository } from "../domain/reading/reading-repository.js";
import { InMemoryDeviceRepository } from "../infrastructure/persistence/in-memory-device-repository.js";
import { SqliteDeviceRepository } from "../infrastructure/persistence/sqlite-device-repository.js";
import { InMemoryCarrierRepository } from "../infrastructure/persistence/in-memory-carrier-repository.js";
import { SqliteCarrierRepository } from "../infrastructure/persistence/sqlite-carrier-repository.js";
import { InMemoryDeliveryRepository } from "../infrastructure/persistence/in-memory-delivery-repository.js";
import { SqliteDeliveryRepository } from "../infrastructure/persistence/sqlite-delivery-repository.js";
import { InMemoryReadingRepository } from "../infrastructure/persistence/in-memory-reading-repository.js";
import { SqliteReadingRepository } from "../infrastructure/persistence/sqlite-reading-repository.js";

/** The set of persistence adapters the application depends on. */
export interface Repositories {
  devices: DeviceRepository;
  carriers: CarrierRepository;
  deliveries: DeliveryRepository;
  readings: ReadingRepository;
}

/**
 * Builds the repositories for the configured persistence backend. Centralising
 * the `memory` vs `sqlite` choice here keeps the composition root declarative.
 */
export function createRepositories(env: Env): Repositories {
  const sqlite = env.PERSISTENCE === "sqlite";
  return {
    devices: sqlite
      ? new SqliteDeviceRepository(env.SQLITE_PATH)
      : new InMemoryDeviceRepository(),
    carriers: sqlite
      ? new SqliteCarrierRepository(env.SQLITE_PATH)
      : new InMemoryCarrierRepository(),
    deliveries: sqlite
      ? new SqliteDeliveryRepository(env.SQLITE_PATH)
      : new InMemoryDeliveryRepository(),
    readings: sqlite
      ? new SqliteReadingRepository(env.SQLITE_PATH)
      : new InMemoryReadingRepository(),
  };
}
