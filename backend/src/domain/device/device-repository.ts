import type { Device } from "./device.js";

/**
 * Port for device persistence. The domain/application layers depend on this
 * interface; concrete adapters (in-memory, Postgres, ...) live in infrastructure.
 */
export interface DeviceRepository {
  save(device: Device): Promise<void>;
  findByDeviceId(deviceId: string): Promise<Device | null>;
  list(): Promise<Device[]>;
}
