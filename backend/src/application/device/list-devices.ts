import type { Device } from "../../domain/device/device.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";

/** Lists all registered devices. */
export class ListDevices {
  constructor(private readonly devices: DeviceRepository) {}

  execute(): Promise<Device[]> {
    return this.devices.list();
  }
}
