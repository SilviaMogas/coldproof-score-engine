import { getAddress, toBeHex, zeroPadValue } from "ethers";

/** Encodes an EVM address in the account-id shape expected by existing use cases. */
export function evmAddressToAccountId(address: string): string {
  return `0.0.${BigInt(getAddress(address)).toString()}`;
}

/** Resolves either a normal EVM address or its lossless 0.0.<uint160> encoding. */
export function accountIdToEvmAddress(accountId: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(accountId)) {
    return getAddress(accountId);
  }
  const match = /^0\.0\.(\d+)$/.exec(accountId);
  if (!match) throw new Error(`invalid Sepolia account id '${accountId}'`);
  const value = BigInt(match[1]!);
  if (value < 0n || value >= 1n << 160n) {
    throw new Error(`Sepolia account id '${accountId}' exceeds 160 bits`);
  }
  return getAddress(zeroPadValue(toBeHex(value), 20));
}
