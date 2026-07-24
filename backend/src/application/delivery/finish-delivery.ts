import type { Delivery } from "../../domain/delivery/delivery.js";
import { finishDelivery } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { releaseDevice } from "../../domain/device/device.js";
import { NotFoundError } from "../../shared/errors.js";

/**
 * Marks a delivery as finished, which releases its device so it can be
 * assigned to another delivery or deleted.
 */
export class FinishDelivery {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository
  ) {}

  async execute(id: string): Promise<Delivery> {
    const existing = await this.deliveries.findById(id.trim());
    if (!existing) {
      throw new NotFoundError(`delivery '${id}' not found`);
    }

    const finished = finishDelivery(existing);
    await this.deliveries.save(finished);

    const device = await this.devices.findByDeviceId(existing.deviceId);
    if (device) {
      await this.devices.save(releaseDevice(device));
    }

    return finished;
  }
}
