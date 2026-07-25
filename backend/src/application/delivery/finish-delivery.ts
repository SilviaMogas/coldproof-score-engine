import type { Delivery } from "../../domain/delivery/delivery.js";
import { finishDelivery } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import { releaseDevice } from "../../domain/device/device.js";
import type { DeliverySettler } from "../settlement/settle-delivery.js";
import { NotFoundError } from "../../shared/errors.js";

/**
 * Marks a delivery as finished, which releases its device so it can be
 * assigned to another delivery or deleted, then settles the escrow purely from
 * the Sepolia contract state (release to carrier or refund to payer).
 */
export class FinishDelivery {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository,
    private readonly settler: DeliverySettler
  ) {}

  async execute(id: string): Promise<Delivery> {
    const existing = await this.deliveries.findById(id.trim());
    if (!existing) {
      throw new NotFoundError(`delivery '${id}' not found`);
    }

    // A failed RPC/transaction leaves a durable `unsettled` result. Repeating
    // the finish command retries settlement without finishing or releasing the
    // device a second time.
    if (
      existing.status === "finished" &&
      existing.settlementStatus === "unsettled"
    ) {
      return this.settler.settle(existing);
    }

    const finished = finishDelivery(existing);
    await this.deliveries.save(finished);

    const device = await this.devices.findByDeviceId(existing.deviceId);
    if (device) {
      await this.devices.save(releaseDevice(device));
    }

    // Settle the escrow from the on-chain contract state (no-op when disabled).
    return this.settler.settle(finished);
  }
}
