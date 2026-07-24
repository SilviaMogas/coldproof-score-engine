import type { Device } from "../../domain/device/device.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";

/**
 * Lists devices that are eligible to be assigned to a new delivery: `active`
 * devices. A device tied to an in-transit delivery is `assigned` and therefore
 * excluded until its delivery is finished.
 */
export class ListAvailableDevices {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(): Promise<Device[]> {
    const devices = await this.devices.list();
    return devices.filter((d) => d.status === "active");
  }
}
