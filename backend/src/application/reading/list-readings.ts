import type { Reading } from "../../domain/reading/reading.js";
import type { ReadingRepository } from "../../domain/reading/reading-repository.js";

/** Lists stored readings, optionally filtered by device. */
export class ListReadings {
  constructor(private readonly readings: ReadingRepository) {}

  execute(deviceId?: string): Promise<Reading[]> {
    const id = deviceId?.trim();
    return id ? this.readings.listByDeviceId(id) : this.readings.list();
  }
}
