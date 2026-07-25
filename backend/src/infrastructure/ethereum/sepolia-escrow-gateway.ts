import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatEther,
  id,
} from "ethers";
import type {
  EscrowGateway,
  EscrowSnapshot,
  EscrowTransfer,
  OnChainEscrowStatus,
} from "../../application/ports/escrow-gateway.js";

const CHAIN_ID = 11155111;
const ABI = [
  "function deliveries(bytes32) view returns (address payer,address payee,bytes32 deviceIdHash,int32 minTemperatureMilliC,int32 maxTemperatureMilliC,uint32 requiredReadings,uint32 compliantReadings,uint32 violations,uint64 deadline,uint256 amount,uint8 status)",
  "function startDelivery(bytes32)",
  "function release(bytes32)",
  "function refund(bytes32)",
] as const;
const STATUSES: OnChainEscrowStatus[] = [
  "none",
  "funded",
  "in_transit",
  "released",
  "refunded",
];

export class SepoliaEscrowGateway implements EscrowGateway {
  private readonly contract: Contract;

  constructor(rpcUrl: string, privateKey: string, contractAddress: string) {
    const provider = new JsonRpcProvider(rpcUrl, CHAIN_ID, {
      staticNetwork: true,
    });
    this.contract = new Contract(
      contractAddress,
      ABI,
      new Wallet(privateKey, provider)
    );
  }

  async inspect(deliveryId: string): Promise<EscrowSnapshot> {
    const values = await this.contract.getFunction("deliveries")(id(deliveryId));
    const status = Number(values.status);
    return {
      payer: status === 0 ? null : String(values.payer),
      payee: status === 0 ? null : String(values.payee),
      deviceIdHash: status === 0 ? null : String(values.deviceIdHash),
      amountEth: Number(formatEther(values.amount)),
      minTemperatureMilliC: Number(values.minTemperatureMilliC),
      maxTemperatureMilliC: Number(values.maxTemperatureMilliC),
      requiredReadings: Number(values.requiredReadings),
      compliantReadings: Number(values.compliantReadings),
      violations: Number(values.violations),
      status: STATUSES[status] ?? "none",
    };
  }

  async start(deliveryId: string): Promise<EscrowTransfer> {
    return this.send("startDelivery", deliveryId);
  }

  async release(deliveryId: string): Promise<EscrowTransfer> {
    return this.send("release", deliveryId);
  }

  async refund(deliveryId: string): Promise<EscrowTransfer> {
    return this.send("refund", deliveryId);
  }

  private async send(method: string, deliveryId: string): Promise<EscrowTransfer> {
    const tx = await this.contract.getFunction(method)(id(deliveryId));
    const receipt = await tx.wait();
    if (!receipt) throw new Error(`${method} transaction was not mined`);
    return { transactionId: receipt.hash, status: "success" };
  }
}
