import test from "node:test";
import assert from "node:assert/strict";
import {
  accountIdToEvmAddress,
  evmAddressToAccountId,
} from "../src/infrastructure/ethereum/account-id.js";

test("round-trips an EVM wallet through the unchanged account-id model", () => {
  const wallet = "0x7D4954f4b1db61a32D7f44c8eDd5af2b9b4a64FE";
  const accountId = evmAddressToAccountId(wallet);
  assert.match(accountId, /^0\.0\.\d+$/);
  assert.equal(accountIdToEvmAddress(accountId), wallet);
});

test("rejects a synthetic account id wider than an EVM address", () => {
  assert.throws(
    () => accountIdToEvmAddress(`0.0.${1n << 160n}`),
    /exceeds 160 bits/
  );
});
