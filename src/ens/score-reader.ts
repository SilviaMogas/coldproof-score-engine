import { AbiCoder, Contract, Interface, getBytes, namehash, type Provider } from "ethers";
import { SCORE_KEYS, type ScoreRecords } from "./score-records.js";

const UNIVERSAL_RESOLVER = "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe";
const universalAbi = ["function resolve(bytes name, bytes data) view returns (bytes result,address resolver)"];
const textInterface = new Interface(["function text(bytes32 node,string key) view returns (string)"]);

export function dnsEncode(name: string): Uint8Array {
  const bytes: number[] = [];
  for (const label of name.split(".")) {
    const encoded = getBytes(new TextEncoder().encode(label));
    if (encoded.length === 0 || encoded.length > 63) throw new Error(`Invalid DNS label in ${name}`);
    bytes.push(encoded.length, ...encoded);
  }
  bytes.push(0);
  return Uint8Array.from(bytes);
}

export class EnsV2ScoreReader {
  private readonly universal: Contract;
  constructor(provider: Provider) {
    this.universal = new Contract(UNIVERSAL_RESOLVER, universalAbi, provider);
  }

  async read(name: string): Promise<{ records: Partial<ScoreRecords>; resolver: string }> {
    const records: Partial<ScoreRecords> = {};
    let resolver = "";
    for (const key of SCORE_KEYS) {
      const call = textInterface.encodeFunctionData("text", [namehash(name), key]);
      try {
        const response = await this.universal.getFunction("resolve")(dnsEncode(name), call) as [string, string];
        resolver = response[1];
        records[key] = AbiCoder.defaultAbiCoder().decode(["string"], response[0])[0] as string;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/resolver|not found|unregistered|revert/i.test(message)) continue;
        throw new Error(`Failed reading ${key} for ${name}: ${message}`);
      }
    }
    if (!resolver) throw new Error(`${name} does not resolve through the active ENS hierarchy`);
    return { records, resolver };
  }
}
