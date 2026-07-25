import type {
  Delivery,
  SettlementResult,
} from "../../domain/delivery/delivery.js";
import { applySettlement } from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";
import type {
  ConsensusReader,
  MirroredReading,
} from "../ports/consensus-reader.js";
import type { EscrowGateway } from "../ports/escrow-gateway.js";

/** Range and identities used to decide and execute a settlement. */
export interface SettlementConfig {
  /** When false, settlement is a no-op (Hedera/escrow not configured). */
  enabled: boolean;
  minTempC: number;
  maxTempC: number;
  /** Account refunded when the cold chain fails; required to refund. */
  shipperAccountId?: string;
}

/** Collaborator that settles a finished delivery. */
export interface DeliverySettler {
  settle(delivery: Delivery): Promise<Delivery>;
}

/**
 * Settles a finished delivery using ONLY the HCS reading log.
 *
 * It reads the topic back from the mirror node, keeps the readings that belong
 * to this delivery's device and time window, and checks every one against the
 * agreed range. If the chain held, the escrow is released to the carrier; if a
 * reading breached (or none can be verified), the shipper is refunded. Any
 * failure to move funds is recorded as `unsettled` rather than throwing, so
 * finishing a delivery never fails because Hedera is unavailable.
 */
export class SettleDelivery implements DeliverySettler {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly carriers: CarrierRepository,
    private readonly reader: ConsensusReader,
    private readonly escrow: EscrowGateway,
    private readonly config: SettlementConfig
  ) {}

  async settle(delivery: Delivery): Promise<Delivery> {
    // Nothing to settle: no escrow, or settlement not configured.
    if (
      !this.config.enabled ||
      delivery.amountHbar <= 0 ||
      delivery.settlementStatus === "disabled"
    ) {
      return delivery;
    }

    // 1. Pull the immutable log and keep this delivery's readings.
    const messages = await this.reader.fetchMessages();
    const temps = messages
      .map((m) => m.payload as Partial<MirroredReading>)
      .filter(
        (p): p is MirroredReading =>
          !!p &&
          p.deviceId === delivery.deviceId &&
          typeof p.receivedAt === "string" &&
          new Date(p.receivedAt) >= delivery.createdAt &&
          typeof p.temperatureC === "number"
      )
      .map((p) => p.temperatureC);

    // 2. Deterministic verdict: every reading must be in range, and there must
    //    be at least one reading to prove the chain was actually monitored.
    const violations = temps.filter(
      (t) => t < this.config.minTempC || t > this.config.maxTempC
    );
    const passed = temps.length > 0 && violations.length === 0;
    const minTempC = temps.length ? Math.min(...temps) : null;
    const maxTempC = temps.length ? Math.max(...temps) : null;

    // 3. Pick the payout recipient.
    const carrier = await this.carriers.findById(delivery.carrierId);
    const recipient = passed
      ? carrier?.hederaAccountId ?? null
      : this.config.shipperAccountId ?? null;

    const baseReason = passed
      ? "cold chain held: all readings within range"
      : temps.length === 0
        ? "no HCS readings to verify the cold chain"
        : `${violations.length} reading(s) breached the range`;

    let verdict: SettlementResult["verdict"] = passed
      ? "released"
      : "refunded";
    let reason = baseReason;
    let transactionId: string | null = null;

    if (!recipient) {
      verdict = "unsettled";
      reason = passed
        ? `${baseReason}, but the carrier has no Hedera account`
        : `${baseReason}, but no shipper refund account is configured`;
    } else {
      // 4. Move the escrowed funds. Best-effort: record failures, never throw.
      try {
        const transfer = await this.escrow.transfer(
          recipient,
          delivery.amountHbar
        );
        transactionId = transfer.transactionId;
      } catch (err) {
        verdict = "unsettled";
        reason = `${baseReason}, but the transfer failed: ${
          (err as Error).message
        }`;
      }
    }

    const result: SettlementResult = {
      verdict,
      reason,
      totalReadings: temps.length,
      violations: violations.length,
      minTempC,
      maxTempC,
      paidTo: transactionId ? recipient : null,
      amountHbar: delivery.amountHbar,
      transactionId,
      settledAt: new Date().toISOString(),
    };

    const settled = applySettlement(delivery, result);
    await this.deliveries.save(settled);
    return settled;
  }
}
