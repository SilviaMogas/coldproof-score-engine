export type OnChainEscrowStatus =
  | "none"
  | "funded"
  | "in_transit"
  | "released"
  | "refunded";

export interface EscrowSnapshot {
  payer: string | null;
  payee: string | null;
  deviceIdHash: string | null;
  amountEth: number;
  minTemperatureMilliC: number;
  maxTemperatureMilliC: number;
  requiredReadings: number;
  compliantReadings: number;
  violations: number;
  status: OnChainEscrowStatus;
}

export interface EscrowTransfer {
  transactionId: string;
  status: string;
}

/** Sepolia contract operations needed by the application layer. */
export interface EscrowGateway {
  inspect(deliveryId: string): Promise<EscrowSnapshot>;
  start(deliveryId: string): Promise<EscrowTransfer>;
  release(deliveryId: string): Promise<EscrowTransfer>;
  refund(deliveryId: string): Promise<EscrowTransfer>;
}
