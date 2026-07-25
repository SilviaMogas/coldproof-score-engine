import type {
  EscrowGateway,
  EscrowSnapshot,
  EscrowTransfer,
} from "../../application/ports/escrow-gateway.js";

export class NoopEscrowGateway implements EscrowGateway {
  async inspect(): Promise<EscrowSnapshot> {
    return {
      payer: null,
      payee: null,
      deviceIdHash: null,
      amountEth: 0,
      minTemperatureMilliC: 0,
      maxTemperatureMilliC: 0,
      requiredReadings: 0,
      compliantReadings: 0,
      violations: 0,
      status: "none",
    };
  }

  async start(): Promise<EscrowTransfer> {
    throw new Error("escrow gateway is disabled");
  }
  async release(): Promise<EscrowTransfer> {
    throw new Error("escrow gateway is disabled");
  }
  async refund(): Promise<EscrowTransfer> {
    throw new Error("escrow gateway is disabled");
  }
}
