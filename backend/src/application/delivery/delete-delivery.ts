import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { releaseDevice } from "../../domain/device/device.js";
import type { EscrowGateway } from "../ports/escrow-gateway.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";

/** Deletes a delivery, freeing its device for reassignment. */
export class DeleteDelivery {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository,
    private readonly escrow: EscrowGateway,
    private readonly settlementEnabled: boolean
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.deliveries.findById(id.trim());
    if (!existing) {
      throw new NotFoundError(`delivery '${id}' not found`);
    }
    if (existing.status === "in_transit") {
      throw new ConflictError(
        `delivery '${id}' cannot be deleted while it is in transit`
      );
    }
    if (
      this.settlementEnabled &&
      existing.amountEth > 0 &&
      existing.settlementStatus !== "released" &&
      existing.settlementStatus !== "refunded"
    ) {
      const chain = await this.escrow.inspect(existing.id);
      if (chain.status !== "none" && chain.status !== "released" && chain.status !== "refunded") {
        throw new ConflictError(
          `delivery '${id}' cannot be deleted while its Sepolia escrow is ${chain.status}`
        );
      }
    }
    await this.deliveries.delete(existing.id);

    const device = await this.devices.findByDeviceId(existing.deviceId);
    if (device) {
      await this.devices.save(releaseDevice(device));
    }
  }
}
