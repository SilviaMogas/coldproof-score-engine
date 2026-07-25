import type {
  Delivery,
  SettlementResult,
} from "../../domain/delivery/delivery.js";
import { applySettlement } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type {
  EscrowGateway,
  EscrowSnapshot,
} from "../ports/escrow-gateway.js";

export interface SettlementConfig {
  enabled: boolean;
  minTempC: number;
  maxTempC: number;
  requiredReadings: number;
}

export interface DeliverySettler {
  settle(delivery: Delivery): Promise<Delivery>;
}

/** Settles from the escrow state produced by Sepolia reading transactions. */
export class SettleDelivery implements DeliverySettler {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly escrow: EscrowGateway,
    private readonly config: SettlementConfig
  ) {}

  async settle(delivery: Delivery): Promise<Delivery> {
    if (
      !this.config.enabled ||
      delivery.amountEth <= 0 ||
      delivery.settlementStatus === "disabled"
    ) {
      return delivery;
    }

    let chain: EscrowSnapshot;
    try {
      chain = await this.escrow.inspect(delivery.id);
    } catch (err) {
      const result: SettlementResult = {
        verdict: "unsettled",
        reason: `could not inspect the Sepolia escrow: ${(err as Error).message}`,
        totalReadings: 0,
        violations: 0,
        minTempC: null,
        maxTempC: null,
        paidTo: null,
        amountEth: delivery.amountEth,
        transactionId: null,
        settledAt: new Date().toISOString(),
      };
      const unsettled = applySettlement(delivery, result);
      await this.deliveries.save(unsettled);
      return unsettled;
    }
    const passed =
      chain.violations === 0 &&
      chain.compliantReadings >= chain.requiredReadings &&
      chain.requiredReadings > 0;
    const baseReason = passed
      ? "cold chain held: required readings were compliant"
      : chain.violations > 0
        ? `${chain.violations} reading(s) breached the range`
        : "insufficient on-chain readings to verify the cold chain";

    let verdict: SettlementResult["verdict"] = passed
      ? "released"
      : "refunded";
    let reason = baseReason;
    let transactionId: string | null = null;
    try {
      const transfer = passed
        ? await this.escrow.release(delivery.id)
        : await this.escrow.refund(delivery.id);
      transactionId = transfer.transactionId;
    } catch (err) {
      verdict = "unsettled";
      reason = `${baseReason}, but the Sepolia transaction failed: ${
        (err as Error).message
      }`;
    }

    const result: SettlementResult = {
      verdict,
      reason,
      totalReadings: chain.compliantReadings + chain.violations,
      violations: chain.violations,
      minTempC: null,
      maxTempC: null,
      paidTo: transactionId ? (passed ? chain.payee : chain.payer) : null,
      amountEth: delivery.amountEth,
      transactionId,
      settledAt: new Date().toISOString(),
    };
    const settled = applySettlement(delivery, result);
    await this.deliveries.save(settled);
    return settled;
  }
}
