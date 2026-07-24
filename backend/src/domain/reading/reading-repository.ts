import type { Reading } from "./reading.js";

/**
 * Port for reading persistence. The application layer depends on this
 * interface; concrete adapters (in-memory, SQLite, ...) live in infrastructure.
 */
export interface ReadingRepository {
  save(reading: Reading): Promise<void>;
  list(): Promise<Reading[]>;
  listByDeviceId(deviceId: string): Promise<Reading[]>;
}
