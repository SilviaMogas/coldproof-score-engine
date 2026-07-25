import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { releaseDevice } from "../../domain/device/device.js";
import { NotFoundError } from "../../shared/errors.js";

/** Deletes a delivery, freeing its device for reassignment. */
export class DeleteDelivery {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.deliveries.findById(id.trim());
    if (!existing) {
      throw new NotFoundError(`delivery '${id}' not found`);
    }
    await this.deliveries.delete(existing.id);

    const device = await this.devices.findByDeviceId(existing.deviceId);
    if (device) {
      await this.devices.save(releaseDevice(device));
    }
  }
}
