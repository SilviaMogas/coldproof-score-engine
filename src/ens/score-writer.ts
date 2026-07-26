import { Contract, Interface, namehash, type Signer, type TransactionReceipt } from "ethers";
import type { ScoreKey, ScoreRecords } from "./score-records.js";

const resolverAbi = [
  "function setText(bytes32 node,string key,string value)",
  "function multicall(bytes[] data) returns (bytes[] results)",
];
const resolverInterface = new Interface(resolverAbi);

export class EnsV2ScoreWriter {
  constructor(private readonly signer: Signer) {}

  async assertPermission(name: string, resolverAddress: string, records: ScoreRecords, keys: ScoreKey[]): Promise<void> {
    const resolver = new Contract(resolverAddress, resolverAbi, this.signer);
    const calls = keys.map((key) =>
      resolverInterface.encodeFunctionData("setText", [namehash(name), key, records[key]]));
    try {
      await resolver.getFunction("multicall").staticCall(calls);
    } catch {
      throw new Error(`ENS administrator lacks permission to update resolver ${resolverAddress}`);
    }
  }

  async write(name: string, resolverAddress: string, records: ScoreRecords, keys: ScoreKey[]): Promise<TransactionReceipt> {
    const resolver = new Contract(resolverAddress, resolverAbi, this.signer);
    const calls = keys.map((key) =>
      resolverInterface.encodeFunctionData("setText", [namehash(name), key, records[key]]));
    const transaction = await resolver.getFunction("multicall")(calls);
    const receipt = await transaction.wait();
    if (!receipt || receipt.status !== 1) throw new Error("ENS resolver transaction failed");
    return receipt as TransactionReceipt;
  }
}
