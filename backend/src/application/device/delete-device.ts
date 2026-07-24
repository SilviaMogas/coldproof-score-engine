import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { NotFoundError } from "../../shared/errors.js";

/** Deletes a registered device. Fails if the device does not exist. */
export class DeleteDevice {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(deviceId: string): Promise<void> {
    const existing = await this.devices.findByDeviceId(deviceId.trim());
    if (!existing) {
      throw new NotFoundError(`device '${deviceId}' not found`);
    }
    await this.devices.delete(existing.deviceId);
  }
}
