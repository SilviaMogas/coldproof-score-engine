import type { Delivery } from "../../domain/delivery/delivery.js";
import { markEscrowed } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";
import type { EscrowGateway } from "../ports/escrow-gateway.js";
import type { SettlementConfig } from "./settle-delivery.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import { id as hashId } from "ethers";

/** Confirms that this exact delivery is funded in the Sepolia contract. */
export class ConfirmEscrow {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly carriers: CarrierRepository,
    private readonly escrow: EscrowGateway,
    private readonly config: SettlementConfig
  ) {}

  async execute(id: string): Promise<Delivery> {
    const delivery = await this.deliveries.findById(id.trim());
    if (!delivery) throw new NotFoundError(`delivery '${id}' not found`);
    if (delivery.settlementStatus === "escrowed") return delivery;
    if (delivery.settlementStatus !== "awaiting_escrow") {
      throw new ValidationError(
        `delivery '${id}' has no pending escrow (settlement: ${delivery.settlementStatus})`
      );
    }
    if (!this.config.enabled) {
      throw new ValidationError("settlement is not configured on this server");
    }

    const carrier = await this.carriers.findById(delivery.carrierId);
    if (!carrier?.walletAddress) {
      throw new ValidationError("carrier has no Sepolia payout address");
    }
    const chain = await this.escrow.inspect(delivery.id);
    if (chain.status !== "funded") {
      throw new ValidationError(
        `delivery escrow is not funded on Sepolia (status: ${chain.status})`
      );
    }
    if (chain.payee?.toLowerCase() !== carrier.walletAddress.toLowerCase()) {
      throw new ValidationError("on-chain escrow payee does not match carrier");
    }
    if (Math.abs(chain.amountEth - delivery.amountEth) > 1e-12) {
      throw new ValidationError(
        `on-chain escrow amount ${chain.amountEth} ETH does not match ${delivery.amountEth} ETH`
      );
    }
    if (chain.deviceIdHash !== hashId(delivery.deviceId)) {
      throw new ValidationError("on-chain escrow device does not match delivery");
    }
    if (
      chain.minTemperatureMilliC !== Math.round(this.config.minTempC * 1000) ||
      chain.maxTemperatureMilliC !== Math.round(this.config.maxTempC * 1000) ||
      chain.requiredReadings !== this.config.requiredReadings
    ) {
      throw new ValidationError("on-chain escrow rules do not match server policy");
    }

    const escrowed = markEscrowed(delivery);
    await this.deliveries.save(escrowed);
    return escrowed;
  }
}
