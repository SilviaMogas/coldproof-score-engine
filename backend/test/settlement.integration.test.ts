import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer, TEST_TOKEN } from "./support/harness.js";
import { FakeDevice } from "./support/fake-device.js";
import type {
  EscrowGateway,
  EscrowSnapshot,
  EscrowTransfer,
} from "../src/application/ports/escrow-gateway.js";
import { id as hashId } from "ethers";

class FakeEscrowGateway implements EscrowGateway {
  readonly escrows = new Map<string, EscrowSnapshot>();
  readonly actions: { action: string; deliveryId: string }[] = [];
  failNextInspect = false;
  private counter = 0;

  async inspect(deliveryId: string): Promise<EscrowSnapshot> {
    if (this.failNextInspect) {
      this.failNextInspect = false;
      throw new Error("temporary RPC failure");
    }
    return (
      this.escrows.get(deliveryId) ?? {
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
      }
    );
  }

  fund(deliveryId: string, deviceId: string, amountEth: number): void {
    this.escrows.set(deliveryId, {
      payer: PAYER,
      payee: CARRIER_WALLET,
      deviceIdHash: hashId(deviceId),
      amountEth,
      minTemperatureMilliC: 2000,
      maxTemperatureMilliC: 8000,
      requiredReadings: 2,
      compliantReadings: 0,
      violations: 0,
      status: "funded",
    });
  }

  readings(deliveryId: string, compliant: number, violations: number): void {
    const escrow = this.escrows.get(deliveryId);
    if (!escrow) throw new Error("escrow missing");
    Object.assign(escrow, { compliantReadings: compliant, violations });
  }

  async start(deliveryId: string): Promise<EscrowTransfer> {
    const escrow = this.escrows.get(deliveryId);
    if (!escrow) throw new Error("escrow missing");
    escrow.status = "in_transit";
    return this.record("start", deliveryId);
  }
  async release(deliveryId: string): Promise<EscrowTransfer> {
    return this.record("release", deliveryId);
  }
  async refund(deliveryId: string): Promise<EscrowTransfer> {
    return this.record("refund", deliveryId);
  }
  private record(action: string, deliveryId: string): EscrowTransfer {
    this.actions.push({ action, deliveryId });
    return { transactionId: `0xtx${++this.counter}`, status: "success" };
  }
}

const CARRIER_WALLET = "0x1111111111111111111111111111111111111111";
const PAYER = "0x9999999999999999999999999999999999999999";
const auth = { authorization: `Bearer ${TEST_TOKEN}` };
let app: FastifyInstance;
let escrow: FakeEscrowGateway;
let carrierId: string;

before(async () => {
  escrow = new FakeEscrowGateway();
  app = await buildTestServer({
    settlement: {
      escrow,
      config: {
        enabled: true,
        minTempC: 2,
        maxTempC: 8,
        requiredReadings: 2,
      },
    },
  });
  const carrier = await app.inject({
    method: "POST",
    url: "/carriers",
    headers: auth,
    payload: { name: "Cold Chain Co", walletAddress: CARRIER_WALLET },
  });
  assert.equal(carrier.statusCode, 201);
  carrierId = carrier.json().id;
});

after(async () => app.close());

async function createDelivery(
  name: string,
  amountEth: number
): Promise<{ id: string; deviceId: string; device: FakeDevice }> {
  const device = new FakeDevice(name);
  await app.inject({
    method: "POST",
    url: "/devices",
    headers: auth,
    payload: {
      deviceId: device.deviceId,
      publicKey: device.publicKeyHex,
      label: name,
    },
  });
  const created = await app.inject({
    method: "POST",
    url: "/deliveries",
    headers: auth,
    payload: {
      from: "Warehouse",
      to: "Clinic",
      boxContents: "Vaccines",
      deviceId: device.deviceId,
      carrierId,
      amountEth,
    },
  });
  assert.equal(created.statusCode, 201);
  return { id: created.json().id, deviceId: device.deviceId, device };
}

async function confirmAndStart(
  id: string,
  deviceId: string,
  amountEth: number
): Promise<void> {
  escrow.fund(id, deviceId, amountEth);
  const confirmed = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/confirm-escrow`,
    headers: auth,
  });
  assert.equal(confirmed.statusCode, 200);
  const started = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/start`,
    headers: auth,
  });
  assert.equal(started.statusCode, 200);
}

test("cannot start before its Sepolia escrow is confirmed", async () => {
  const { id } = await createDelivery("settle-gate", 0.05);
  const response = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/start`,
    headers: auth,
  });
  assert.equal(response.statusCode, 400);
});

test("starting from the device seal also starts the Sepolia escrow", async () => {
  const { id, deviceId, device } = await createDelivery(
    "settle-seal-start",
    0.05
  );
  escrow.fund(id, deviceId, 0.05);
  const confirmed = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/confirm-escrow`,
    headers: auth,
  });
  assert.equal(confirmed.statusCode, 200);

  const request = device.requestUnlock("seal-start");
  const sealed = await app.inject({
    method: "POST",
    url: "/seal",
    payload: request,
  });
  assert.equal(sealed.statusCode, 200);
  assert.equal(sealed.json().sealed, true);
  assert.deepEqual(escrow.actions.at(-1), { action: "start", deliveryId: id });
  assert.equal(escrow.escrows.get(id)?.status, "in_transit");

  const replayed = await app.inject({
    method: "POST",
    url: "/seal",
    payload: request,
  });
  assert.equal(replayed.statusCode, 401);
});

test("cannot delete a delivery while its Sepolia escrow is active", async () => {
  const { id, deviceId } = await createDelivery("settle-delete-guard", 0.05);
  await confirmAndStart(id, deviceId, 0.05);
  const response = await app.inject({
    method: "DELETE",
    url: `/deliveries/${id}`,
    headers: auth,
  });
  assert.equal(response.statusCode, 409);
});

test("rejects an on-chain amount mismatch", async () => {
  const { id, deviceId } = await createDelivery("settle-mismatch", 0.05);
  escrow.fund(id, deviceId, 0.01);
  const response = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/confirm-escrow`,
    headers: auth,
  });
  assert.equal(response.statusCode, 400);
});

test("releases after the required compliant readings", async () => {
  const { id, deviceId } = await createDelivery("settle-ok", 0.05);
  await confirmAndStart(id, deviceId, 0.05);
  escrow.readings(id, 2, 0);
  const response = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(response.json().settlementStatus, "released");
  assert.equal(response.json().settlement.amountEth, 0.05);
  assert.equal(response.json().settlement.paidTo, CARRIER_WALLET);
  assert.equal(escrow.actions.at(-1)?.action, "release");
});

test("refunds when a reading violated the range", async () => {
  const { id, deviceId } = await createDelivery("settle-breach", 0.03);
  await confirmAndStart(id, deviceId, 0.03);
  escrow.readings(id, 1, 1);
  const response = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(response.json().settlementStatus, "refunded");
  assert.equal(response.json().settlement.paidTo, PAYER);
  assert.equal(escrow.actions.at(-1)?.action, "refund");
});

test("records an RPC failure as unsettled and retries on finish", async () => {
  const { id, deviceId } = await createDelivery("settle-retry", 0.02);
  await confirmAndStart(id, deviceId, 0.02);
  escrow.readings(id, 2, 0);
  escrow.failNextInspect = true;

  const failed = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(failed.statusCode, 200);
  assert.equal(failed.json().status, "finished");
  assert.equal(failed.json().settlementStatus, "unsettled");

  const retried = await app.inject({
    method: "POST",
    url: `/deliveries/${id}/finish`,
    headers: auth,
  });
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.json().settlementStatus, "released");
  assert.equal(escrow.actions.at(-1)?.action, "release");
});

test("does not settle a breach that failed to reach Sepolia", async () => {
  const { id, deviceId, device } = await createDelivery(
    "settle-chain-outage",
    0.02
  );
  await confirmAndStart(id, deviceId, 0.02);
  escrow.readings(id, 2, 0);
  const actionCount = escrow.actions.length;

  // The test server uses a no-op consensus log. The local breach is accepted,
  // but must not settle from the stale compliant on-chain snapshot.
  const ingested = await app.inject({
    method: "POST",
    url: "/readings",
    payload: device.nextReading(20),
  });
  assert.equal(ingested.statusCode, 201);
  assert.equal(ingested.json().consensus, null);

  const listed = await app.inject({
    method: "GET",
    url: "/deliveries",
    headers: auth,
  });
  const delivery = listed
    .json()
    .deliveries.find((candidate: { id: string }) => candidate.id === id);
  assert.equal(delivery.status, "in_transit");
  assert.equal(delivery.settlementStatus, "escrowed");
  assert.equal(escrow.actions.length, actionCount);
});
