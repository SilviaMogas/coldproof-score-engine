import type { Eip1193Provider } from "ethers";
import type { AppConfig } from "../api/config";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/** Funds the Sepolia oracle escrow float, mirroring Hedera's operator account. */
export async function fundSepoliaEscrow(
  amountEth: number,
  config: AppConfig
): Promise<string> {
  if (!window.ethereum) throw new Error("No browser wallet was detected");
  if (!config.escrowAccount || !config.chainId) {
    throw new Error("Sepolia escrow account is not configured");
  }
  const { BrowserProvider, parseEther } = await import("ethers");
  const expectedChain = `0x${config.chainId.toString(16)}`;
  const currentChain = await window.ethereum.request({ method: "eth_chainId" });
  if (currentChain !== expectedChain) {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedChain }],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const tx = await signer.sendTransaction({
    to: config.escrowAccount,
    value: parseEther(String(amountEth)),
  });
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Sepolia funding transaction was not mined");
  return receipt.hash;
}
