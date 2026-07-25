import type { Delivery } from "../../domain/delivery/delivery.js";
import { startDelivery } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { EscrowGateway } from "../ports/escrow-gateway.js";
import { NotFoundError } from "../../shared/errors.js";

/** Starts a delivery, moving it from `ready` to `in_transit`. */
export class StartDelivery {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly escrow: EscrowGateway
  ) {}

  async execute(id: string): Promise<Delivery> {
    const existing = await this.deliveries.findById(id.trim());
    if (!existing) {
      throw new NotFoundError(`delivery '${id}' not found`);
    }

    const started = startDelivery(existing);
    if (existing.settlementStatus === "escrowed") {
      await this.escrow.start(existing.id);
    }
    await this.deliveries.save(started);
    return started;
  }
}
