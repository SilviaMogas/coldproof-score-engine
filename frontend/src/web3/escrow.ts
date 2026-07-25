import type { Eip1193Provider } from "ethers";
import type { AppConfig } from "../api/config";
import type { DeliveryDto } from "../api/deliveries";

const ABI = [
  "function fundDelivery(bytes32 deliveryId,address payee,bytes32 deviceIdHash,int32 minTemperatureMilliC,int32 maxTemperatureMilliC,uint32 requiredReadings,uint64 deadline) payable",
] as const;

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export async function fundDeliveryEscrow(
  delivery: DeliveryDto,
  config: AppConfig
): Promise<string> {
  if (!window.ethereum) throw new Error("No browser wallet was detected");
  if (!config.escrowAddress) throw new Error("Escrow contract is not configured");
  if (!delivery.carrierWalletAddress) {
    throw new Error("Carrier has no Sepolia payout address");
  }

  const { BrowserProvider, Contract, id, parseEther } = await import("ethers");
  const expectedChain = `0x${config.chainId.toString(16)}`;
  const currentChain = await window.ethereum.request({
    method: "eth_chainId",
  });
  if (currentChain !== expectedChain) {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedChain }],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(config.escrowAddress, ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + config.durationSeconds;
  const tx = await contract.getFunction("fundDelivery")(
    id(delivery.id),
    delivery.carrierWalletAddress,
    id(delivery.deviceId),
    Math.round(config.minTempC * 1000),
    Math.round(config.maxTempC * 1000),
    config.requiredReadings,
    deadline,
    { value: parseEther(String(delivery.amountEth)) }
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Escrow funding transaction was not mined");
  return receipt.hash;
}
