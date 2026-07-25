import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer, TEST_TOKEN } from "./support/harness.js";
import { FakeDevice } from "./support/fake-device.js";
import type {
  ConsensusMessage,
  ConsensusReader,
  MirroredReading,
} from "../src/application/ports/consensus-reader.js";
import type {
  EscrowGateway,
  EscrowTransfer,
} from "../src/application/ports/escrow-gateway.js";

/**
 * End-to-end test of the Option A escrow settlement flow:
 *   create (awaiting_escrow) → confirm-escrow (escrowed) → start → finish,
 * with the finish verdict computed ONLY from the HCS reading log (via a fake
 * consensus reader) and the payout executed through a fake escrow gateway.
 */

/** Consensus reader whose readings are set per scenario. */
class FakeConsensusReader implements ConsensusReader {
  private readings: MirroredReading[] = [];
  private seq = 0;

  /** Replace the log with readings of `temps` for `deviceId`, dated now. */
  setReadings(deviceId: string, temps: number[]): void {
    const now = new Date().toISOString();
    this.readings = temps.map((t, i) => ({
      deviceId,
      seq: i + 1,
      temperatureC: t,
      unit: "C",
      ts: now,
      pubKey: "",
      sig: "",
      receivedAt: now,
    }));
  }

  async fetchMessages(): Promise<ConsensusMessage[]> {
    return this.readings.map((payload) => ({
      sequenceNumber: ++this.seq,
      consensusTimestamp: "1700000000.000000000",
      payload,
    }));
  }
}

/** Escrow gateway with a fixed balance that records every transfer. */
class FakeEscrowGateway implements EscrowGateway {
  readonly transfers: { to: string; amount: number }[] = [];
  private counter = 0;

  constructor(private balance: number) {}

  async balanceHbar(): Promise<number> {
    return this.balance;
  }

  async transfer(to: string, amount: number): Promise<EscrowTransfer> {
    this.transfers.push({ to, amount });
    return { transactionId: `0.0.1@${++this.counter}`, status: "SUCCESS" };
  }
}

const CARRIER_ACCOUNT = "0.0.1111";
const SHIPPER_ACCOUNT = "0.0.9999";

let app: FastifyInstance;
let reader: FakeConsensusReader;
let escrow: FakeEscrowGateway;
let carrierId: string;
const auth = { authorization: `Bearer ${TEST_TOKEN}` };

before(async () => {
  reader = new FakeConsensusReader();
  escrow = new FakeEscrowGateway(1000);
  app = await buildTestServer({
    settlement: {
      reader,
      escrow,
      config: {
        enabled: true,
        minTempC: 2,
        maxTempC: 8,
        shipperAccountId: SHIPPER_ACCOUNT,
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/carriers",
    headers: auth,
    payload: { name: "Cold Chain Co", hederaAccountId: CARRIER_ACCOUNT },
  });
  assert.equal(res.statusCode, 201);
  carrierId = res.json().id;
  assert.equal(res.json().hederaAccountId, CARRIER_ACCOUNT);
});

after(async () => {
  await app.close();
});

/** Registers a fresh device and returns its id. */
async function registerDevice(id: string): Promise<string> {
  const device = new FakeDevice(id);
  const res = await app.inject({
    method: "POST",
    url: "/devices",
    headers: auth,
    payload: {
      deviceId: device.deviceId,
      publicKey: device.publicKeyHex,
      label: id,
    },
  });
  assert.equal(res.statusCode, 201);
  return device.deviceId;
}

/** Creates a delivery with an escrow amount and returns its id. */
async function createDelivery(
  deviceId: string,
  amountHbar: number
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/deliveries",
    headers: auth,
    payload: {
      from: "Warehouse",
      to: "Clinic",
      boxContents: "Vaccines",
      deviceId,
      carrierId,
      amountHbar,
    },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().amountHbar, amountHbar);
  assert.equal(res.json().settlementStatus, "awaiting_escrow");
  return res.json().id;
}

test("cannot start a delivery before its escrow is confirmed", async () => {
  const deviceId = await registerDevice("settle-gate");
  const id = await createDelivery(deviceId, 50);

  const res = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/start`,
    headers: auth,
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, "VALIDATION_ERROR");
});

test("releases the escrow to the carrier when the cold chain held", async () => {
  const deviceId = await registerDevice("settle-ok");
  const id = await createDelivery(deviceId, 50);

  const confirm = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/confirm-escrow`,
    headers: auth,
  });
  assert.equal(confirm.statusCode, 200);
  assert.equal(confirm.json().settlementStatus, "escrowed");

  const start = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/start`,
    headers: auth,
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.json().status, "in_transit");

  reader.setReadings(deviceId, [3.5, 4.1, 5.0]);
  const before = escrow.transfers.length;

  const finish = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(finish.statusCode, 200);
  const body = finish.json();
  assert.equal(body.settlementStatus, "released");
  assert.equal(body.settlement.verdict, "released");
  assert.equal(body.settlement.paidTo, CARRIER_ACCOUNT);
  assert.equal(body.settlement.amountHbar, 50);
  assert.equal(body.settlement.violations, 0);
  assert.equal(body.settlement.totalReadings, 3);
  assert.ok(body.settlement.transactionId);

  assert.equal(escrow.transfers.length, before + 1);
  assert.deepEqual(escrow.transfers.at(-1), { to: CARRIER_ACCOUNT, amount: 50 });
});

test("refunds the shipper when a reading breached the range", async () => {
  const deviceId = await registerDevice("settle-breach");
  const id = await createDelivery(deviceId, 30);

  await app.inject({
    method: "POST",
    url: `/deliveries/${id}/confirm-escrow`,
    headers: auth,
  });
  await app.inject({
    method: "POST",
    url: `/deliveries/${id}/start`,
    headers: auth,
  });

  reader.setReadings(deviceId, [3.0, 12.4, 4.0]);
  const before = escrow.transfers.length;

  const finish = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(finish.statusCode, 200);
  const body = finish.json();
  assert.equal(body.settlementStatus, "refunded");
  assert.equal(body.settlement.verdict, "refunded");
  assert.equal(body.settlement.paidTo, SHIPPER_ACCOUNT);
  assert.equal(body.settlement.violations, 1);

  assert.equal(escrow.transfers.length, before + 1);
  assert.deepEqual(escrow.transfers.at(-1), { to: SHIPPER_ACCOUNT, amount: 30 });
});

test("refunds the shipper when there are no HCS readings to verify", async () => {
  const deviceId = await registerDevice("settle-empty");
  const id = await createDelivery(deviceId, 20);

  await app.inject({
    method: "POST",
    url: `/deliveries/${id}/confirm-escrow`,
    headers: auth,
  });
  await app.inject({
    method: "POST",
    url: `/deliveries/${id}/start`,
    headers: auth,
  });

  reader.setReadings(deviceId, []);
  const before = escrow.transfers.length;

  const finish = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(finish.statusCode, 200);
  const body = finish.json();
  assert.equal(body.settlementStatus, "refunded");
  assert.equal(body.settlement.verdict, "refunded");
  assert.equal(body.settlement.totalReadings, 0);
  assert.equal(body.settlement.paidTo, SHIPPER_ACCOUNT);

  assert.equal(escrow.transfers.length, before + 1);
  assert.deepEqual(escrow.transfers.at(-1), { to: SHIPPER_ACCOUNT, amount: 20 });
});

test("confirm-escrow fails when the escrow balance is insufficient", async () => {
  const poor = new FakeEscrowGateway(5);
  const poorApp = await buildTestServer({
    settlement: {
      reader: new FakeConsensusReader(),
      escrow: poor,
      config: {
        enabled: true,
        minTempC: 2,
        maxTempC: 8,
        shipperAccountId: SHIPPER_ACCOUNT,
      },
    },
  });

  const carrier = await poorApp.inject({
    method: "POST",
    url: "/carriers",
    headers: auth,
    payload: { name: "Carrier", hederaAccountId: CARRIER_ACCOUNT },
  });
  const device = new FakeDevice("settle-poor");
  await poorApp.inject({
    method: "POST",
    url: "/devices",
    headers: auth,
    payload: {
      deviceId: device.deviceId,
      publicKey: device.publicKeyHex,
      label: "poor",
    },
  });
  const created = await poorApp.inject({
    method: "POST",
    url: "/deliveries",
    headers: auth,
    payload: {
      from: "A",
      to: "B",
      boxContents: "X",
      deviceId: device.deviceId,
      carrierId: carrier.json().id,
      amountHbar: 100,
    },
  });

  const confirm = await poorApp.inject({
    method: "POST",
    url: `/deliveries/${created.json().id}/confirm-escrow`,
    headers: auth,
  });
  assert.equal(confirm.statusCode, 400);
  assert.equal(confirm.json().error.code, "VALIDATION_ERROR");

  await poorApp.close();
});
