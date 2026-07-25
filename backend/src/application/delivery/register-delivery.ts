import type { Delivery } from "../../domain/delivery/delivery.js";
import { createDelivery } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { assignDevice } from "../../domain/device/device.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";
import { ValidationError } from "../../shared/errors.js";

export interface RegisterDeliveryInput {
  from: string;
  to: string;
  boxContents: string;
  deviceId: string;
  carrierId: string;
  /** HBAR to hold in escrow for this delivery. Defaults to 0 (no settlement). */
  amountHbar?: number;
}

/**
 * Creates a delivery. Ensures the chosen device exists and is active (not
 * already assigned to another in-transit delivery) and that the carrier
 * exists, then locks the device by marking it `assigned`.
 *
 * When an escrow amount is requested, settlement must be configured on the
 * server; otherwise the delivery could never fund its escrow or settle.
 */
export class RegisterDelivery {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository,
    private readonly carriers: CarrierRepository,
    private readonly settlementEnabled: boolean
  ) {}

  async execute(input: RegisterDeliveryInput): Promise<Delivery> {
    const deviceId = input.deviceId?.trim();
    const carrierId = input.carrierId?.trim();
    const amountHbar = input.amountHbar ?? 0;

    if (amountHbar > 0 && !this.settlementEnabled) {
      throw new ValidationError(
        "settlement is not configured on this server; create the delivery without an escrow amount"
      );
    }

    const device = deviceId
      ? await this.devices.findByDeviceId(deviceId)
      : null;
    if (!device) {
      throw new ValidationError(`device '${deviceId}' does not exist`);
    }
    if (device.status !== "active") {
      throw new ValidationError(
        `device '${deviceId}' is not available (status: ${device.status})`
      );
    }

    const carrier = carrierId
      ? await this.carriers.findById(carrierId)
      : null;
    if (!carrier) {
      throw new ValidationError(`carrier '${carrierId}' does not exist`);
    }

    const delivery = createDelivery({ ...input, amountHbar });
    await this.deliveries.save(delivery);
    await this.devices.save(assignDevice(device));
    return delivery;
  }
}
