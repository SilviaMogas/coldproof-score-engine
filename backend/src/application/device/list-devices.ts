import type { Device } from "../../domain/device/device.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";

/**
 * Read model of a device with a derived `inTransit` flag: true when the device
 * is assigned to a delivery that is currently in transit. It is computed on the
 * fly (not stored) so the device row can display "assigned - in transit".
 */
export interface DeviceView extends Device {
  inTransit: boolean;
}

/** Lists all registered devices, enriched with the derived in-transit flag. */
export class ListDevices {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly deliveries: DeliveryRepository
  ) {}

  async execute(): Promise<DeviceView[]> {
    const [devices, deliveries] = await Promise.all([
      this.devices.list(),
      this.deliveries.list(),
    ]);

    const inTransit = new Set(
      deliveries
        .filter((d) => d.status === "in_transit")
        .map((d) => d.deviceId)
    );

    return devices.map((device) => ({
      ...device,
      inTransit: inTransit.has(device.deviceId),
    }));
  }
}
