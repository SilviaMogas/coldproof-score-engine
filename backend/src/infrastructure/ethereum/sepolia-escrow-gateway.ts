import {
  JsonRpcProvider,
  Wallet,
  formatEther,
  parseEther,
} from "ethers";
import type {
  EscrowGateway,
  EscrowTransfer,
} from "../../application/ports/escrow-gateway.js";
import { accountIdToEvmAddress } from "./account-id.js";

const SEPOLIA_CHAIN_ID = 11155111;

/**
 * Sepolia implementation of the existing escrow-account port. The configured
 * oracle wallet holds the escrow float, exactly as the Hedera operator account
 * does, and signs release/refund transfers selected by the unchanged use case.
 */
export class SepoliaEscrowGateway implements EscrowGateway {
  private readonly provider: JsonRpcProvider;
  private readonly wallet: Wallet;

  constructor(rpcUrl: string, privateKey: string) {
    this.provider = new JsonRpcProvider(rpcUrl, SEPOLIA_CHAIN_ID, {
      staticNetwork: true,
    });
    this.wallet = new Wallet(privateKey, this.provider);
  }

  async balanceHbar(): Promise<number> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return Number(formatEther(balance));
  }

  async transfer(
    toAccountId: string,
    amountHbar: number
  ): Promise<EscrowTransfer> {
    const tx = await this.wallet.sendTransaction({
      to: accountIdToEvmAddress(toAccountId),
      value: parseEther(String(amountHbar)),
    });
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Sepolia transfer was not mined");
    return { transactionId: receipt.hash, status: "SUCCESS" };
  }
}
