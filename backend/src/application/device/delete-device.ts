import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";

/**
 * Deletes a registered device. Fails if the device does not exist, or if it is
 * currently assigned to an in-transit delivery (it must be finished first).
 */
export class DeleteDevice {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(deviceId: string): Promise<void> {
    const existing = await this.devices.findByDeviceId(deviceId.trim());
    if (!existing) {
      throw new NotFoundError(`device '${deviceId}' not found`);
    }
    if (existing.status === "assigned") {
      throw new ConflictError(
        `device '${deviceId}' is assigned to a delivery and cannot be deleted until it is finished`
      );
    }
    await this.devices.delete(existing.deviceId);
  }
}
