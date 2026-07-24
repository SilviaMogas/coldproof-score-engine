import type { Reading } from "../../domain/reading/reading.js";
import type { ReadingRepository } from "../../domain/reading/reading-repository.js";

/** In-memory reading store. Swap for a durable adapter without touching callers. */
export class InMemoryReadingRepository implements ReadingRepository {
  private readonly store: Reading[] = [];

  async save(reading: Reading): Promise<void> {
    this.store.push(reading);
  }

  async list(): Promise<Reading[]> {
    return [...this.store].sort(
      (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()
    );
  }

  async listByDeviceId(deviceId: string): Promise<Reading[]> {
    return (await this.list()).filter((r) => r.deviceId === deviceId);
  }
}
