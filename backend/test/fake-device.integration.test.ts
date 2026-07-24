import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildTestServer, TEST_TOKEN } from "./support/harness.js";
import { FakeDevice } from "./support/fake-device.js";

/**
 * End-to-end integration test driven by a software "fake device". It exercises
 * the full path a real ESP32 sensor would take:
 *   1. the backoffice registers the device (its Ed25519 public key),
 *   2. the device signs readings exactly like the firmware, and
 *   3. the backend authenticates the signature and ingests the readings.
 */

let app: FastifyInstance;
const device = new FakeDevice("fake-integration-01");
const auth = { authorization: `Bearer ${TEST_TOKEN}` };

before(async () => {
  app = await buildTestServer();
});

after(async () => {
  await app.close();
});

test("registers the fake device", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/devices",
    headers: auth,
    payload: {
      deviceId: device.deviceId,
      publicKey: device.publicKeyHex,
      label: "Fake integration device",
    },
  });

  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.deviceId, device.deviceId);
  assert.equal(body.publicKey, device.publicKeyHex);
  assert.equal(body.status, "active");
});

test("rejects a reading with a tampered signature (401)", async () => {
  const envelope = device.nextReading(4.2);
  const tampered = { ...envelope, signature: "00".repeat(64) };

  const res = await app.inject({
    method: "POST",
    url: "/readings",
    payload: tampered,
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, "UNAUTHORIZED");
});

test("rejects a validly-signed reading from an unregistered device (403)", async () => {
  const stranger = new FakeDevice("not-registered");
  const envelope = stranger.nextReading(3.1);

  const res = await app.inject({
    method: "POST",
    url: "/readings",
    payload: envelope,
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error.code, "FORBIDDEN");
});

test("rejects a malformed envelope (400)", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/readings",
    payload: {},
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, "VALIDATION_ERROR");
});

test("ingests a valid signed reading (201)", async () => {
  const envelope = device.nextReading(5.5);

  const res = await app.inject({
    method: "POST",
    url: "/readings",
    payload: envelope,
  });

  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.deviceId, device.deviceId);
  assert.equal(body.temperatureC, 5.5);
  assert.equal(body.unit, "C");
  // A no-op consensus log is used in tests, so nothing is mirrored to HCS.
  assert.equal(body.consensus, null);
});

test("lists the ingested reading for the device", async () => {
  const res = await app.inject({
    method: "GET",
    url: `/readings?deviceId=${device.deviceId}`,
    headers: auth,
  });

  assert.equal(res.statusCode, 200);
  const { readings } = res.json();
  assert.ok(Array.isArray(readings));
  assert.equal(readings.length, 1);
  assert.equal(readings[0].deviceId, device.deviceId);
  assert.equal(readings[0].temperatureC, 5.5);
});
