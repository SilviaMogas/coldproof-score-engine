import type { Device } from "../../domain/device/device.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";

/** In-memory device store. Swap for a Postgres adapter without touching callers. */
export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly store = new Map<string, Device>();

  async save(device: Device): Promise<void> {
    this.store.set(device.deviceId, device);
  }

  async findByDeviceId(deviceId: string): Promise<Device | null> {
    return this.store.get(deviceId) ?? null;
  }

  async list(): Promise<Device[]> {
    return [...this.store.values()];
  }
}
