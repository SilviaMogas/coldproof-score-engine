import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";
import type {
  DeliveryStatus,
  SettlementResult,
  SettlementStatus,
} from "../../domain/delivery/delivery.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";

/** Read model of a delivery enriched with the device label and carrier name. */
export interface DeliveryView {
  id: string;
  from: string;
  to: string;
  boxContents: string;
  deviceId: string;
  deviceLabel: string | null;
  carrierId: string;
  carrierName: string | null;
  status: DeliveryStatus;
  amountHbar: number;
  settlementStatus: SettlementStatus;
  settlement: SettlementResult | null;
  createdAt: Date;
}

/** Lists all deliveries, enriched with device and carrier display names. */
export class ListDeliveries {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly devices: DeviceRepository,
    private readonly carriers: CarrierRepository
  ) {}

  async execute(): Promise<DeliveryView[]> {
    const [deliveries, devices, carriers] = await Promise.all([
      this.deliveries.list(),
      this.devices.list(),
      this.carriers.list(),
    ]);

    const deviceById = new Map(devices.map((d) => [d.deviceId, d]));
    const carrierById = new Map(carriers.map((c) => [c.id, c]));

    return deliveries.map((d) => ({
      id: d.id,
      from: d.from,
      to: d.to,
      boxContents: d.boxContents,
      deviceId: d.deviceId,
      deviceLabel: deviceById.get(d.deviceId)?.label ?? null,
      carrierId: d.carrierId,
      carrierName: carrierById.get(d.carrierId)?.name ?? null,
      status: d.status,
      amountHbar: d.amountHbar,
      settlementStatus: d.settlementStatus,
      settlement: d.settlement,
      createdAt: d.createdAt,
    }));
  }
}
