import type { Delivery } from "../../domain/delivery/delivery.js";
import { markEscrowed } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { EscrowGateway } from "../ports/escrow-gateway.js";
import type { SettlementConfig } from "./settle-delivery.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";

/**
 * Confirms the escrow account holds enough HBAR to cover a delivery, moving it
 * from `awaiting_escrow` to `escrowed`. A delivery cannot start until this
 * passes, so funds are guaranteed to be in escrow before the box ships.
 */
export class ConfirmEscrow {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly escrow: EscrowGateway,
    private readonly config: SettlementConfig
  ) {}

  async execute(id: string): Promise<Delivery> {
    const delivery = await this.deliveries.findById(id.trim());
    if (!delivery) {
      throw new NotFoundError(`delivery '${id}' not found`);
    }

    // Idempotent: already funded.
    if (delivery.settlementStatus === "escrowed") {
      return delivery;
    }
    if (delivery.settlementStatus !== "awaiting_escrow") {
      throw new ValidationError(
        `delivery '${id}' has no pending escrow (settlement: ${delivery.settlementStatus})`
      );
    }
    if (!this.config.enabled) {
      throw new ValidationError("settlement is not configured on this server");
    }

    const balance = await this.escrow.balanceHbar();
    if (balance < delivery.amountHbar) {
      throw new ValidationError(
        `escrow not funded: balance ${balance} ℏ is below the required ${delivery.amountHbar} ℏ`
      );
    }

    const escrowed = markEscrowed(delivery);
    await this.deliveries.save(escrowed);
    return escrowed;
  }
}
