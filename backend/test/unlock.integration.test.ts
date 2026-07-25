import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer, TEST_TOKEN } from "./support/harness.js";
import { FakeDevice } from "./support/fake-device.js";
import { Ed25519SignatureVerifier } from "../src/infrastructure/crypto/ed25519-signature-verifier.js";

/**
 * Integration test for the server-authoritative secure-box unlock. It walks the
 * full delivery: register device, ship it, and prove the box only opens when a
 * delivery is in transit and no reading breached the temperature range — and
 * that the returned command is genuinely signed by the backend key.
 */

let app: FastifyInstance;
const device = new FakeDevice("fake-unlock-01");
const auth = { authorization: `Bearer ${TEST_TOKEN}` };
const verifier = new Ed25519SignatureVerifier();

let deliveryId: string;
let carrierId: string;

before(async () => {
  app = await buildTestServer();

  await app.inject({
    method: "POST",
    url: "/devices",
    headers: auth,
    payload: {
      deviceId: device.deviceId,
      publicKey: device.publicKeyHex,
      label: "Secure box",
    },
  });

  const carrierRes = await app.inject({
    method: "POST",
    url: "/carriers",
    headers: auth,
    payload: { name: "ACME Cold Logistics" },
  });
  carrierId = carrierRes.json().id;

  const deliveryRes = await app.inject({
    method: "POST",
    url: "/deliveries",
    headers: auth,
    payload: {
      from: "Warehouse A",
      to: "Hospital B",
      boxContents: "Insulin",
      deviceId: device.deviceId,
      carrierId,
    },
  });
  deliveryId = deliveryRes.json().id;
});

after(async () => {
  await app.close();
});

test("exposes the backend unlock public key", async () => {
  const res = await app.inject({ method: "GET", url: "/unlock/public-key" });
  assert.equal(res.statusCode, 200);
  assert.match(res.json().publicKey, /^[0-9a-f]{64}$/);
});

test("denies unlock while the delivery has not started", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/unlock",
    payload: device.requestUnlock("nonce-ready"),
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.authorized, false);
  assert.equal(body.reason, "no_active_delivery");
});

test("rejects an unlock request with a bad signature (401)", async () => {
  const envelope = device.requestUnlock("nonce-bad");
  const tampered = { ...envelope, signature: "00".repeat(64) };

  const res = await app.inject({
    method: "POST",
    url: "/unlock",
    payload: tampered,
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, "UNAUTHORIZED");
});

test("authorizes unlock for an in-transit delivery with readings in range", async () => {
  await app.inject({
    method: "POST",
    url: `/deliveries/${deliveryId}/start`,
    headers: auth,
  });

  // A reading well within the cold-chain range [2, 8].
  await app.inject({
    method: "POST",
    url: "/readings",
    payload: device.nextReading(4.0),
  });

  const nonce = "nonce-arrival";
  const res = await app.inject({
    method: "POST",
    url: "/unlock",
    payload: device.requestUnlock(nonce),
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.authorized, true);

  // The command must be genuinely signed by the backend key.
  assert.ok(
    verifier.verify(body.command, body.publicKey, body.signature),
    "returned command signature must verify against the backend public key"
  );

  const command = JSON.parse(body.command);
  assert.equal(command.deviceId, device.deviceId);
  assert.equal(command.deliveryId, deliveryId);
  assert.equal(command.nonce, nonce);
  assert.equal(command.action, "unlock");
  assert.ok(command.exp > Math.floor(Date.now() / 1000));
});

test("denies unlock after a temperature breach", async () => {
  // The previous test finalized the shared delivery, so set up a fresh trip for
  // this device (it was released on finalize) to exercise the breach path.
  const breachDeliveryRes = await app.inject({
    method: "POST",
    url: "/deliveries",
    headers: auth,
    payload: {
      from: "Warehouse A",
      to: "Hospital B",
      boxContents: "Insulin",
      deviceId: device.deviceId,
      carrierId,
    },
  });
  const breachDeliveryId = breachDeliveryRes.json().id;
  await app.inject({
    method: "POST",
    url: `/deliveries/${breachDeliveryId}/start`,
    headers: auth,
  });

  // A reading far outside the range trips the breach, which finalizes the trip.
  await app.inject({
    method: "POST",
    url: "/readings",
    payload: device.nextReading(30.0),
  });

  // The breach must have finalized the delivery.
  const listRes = await app.inject({
    method: "GET",
    url: "/deliveries",
    headers: auth,
  });
  const breached = listRes
    .json()
    .deliveries.find((d: { id: string }) => d.id === breachDeliveryId);
  assert.equal(breached.status, "finished");

  // With the delivery finished, a later unlock finds no active trip.
  const res = await app.inject({
    method: "POST",
    url: "/unlock",
    payload: device.requestUnlock("nonce-breach"),
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.authorized, false);
  assert.equal(body.reason, "no_active_delivery");
});
