/**
 * Cold-chain SECURE BOX node (ESP32 + DS18B20 + reed switch + servo latch).
 *
 * The box carries temperature-critical medicines from A to B and stays locked
 * in transit. It:
 *   1. Reads the DS18B20 probe every cycle, signs the reading with its Ed25519
 *      device key and POSTs it to the backend (mirrored to Hedera HCS).
 *   2. Locks the latch when sealed and lights the LEDs by state.
 *   3. On the unlock button, asks the backend for permission. The backend only
 *      approves when the delivery is in transit and no reading breached the
 *      range, returning a SIGNED command. The box verifies that signature with
 *      the backend public key before driving the servo — so a spoofed or
 *      replayed response cannot open it.
 *
 * State / LED map:
 *   UNLOCKED : latch open, GREEN solid    (loading, or delivered)
 *   LOCKED   : latch shut, RED solid       (sealed, in transit, healthy)
 *   BREACH   : latch shut, RED blinking    (temperature breach — stays shut)
 *
 * Button (normally-closed): press while UNLOCKED + door closed => seal (lock);
 * press while LOCKED/BREACH => request unlock from the backend.
 *
 * This file only wires the modules together:
 *   boxio     - hardware I/O (state, latch, LEDs, door, button, probe)
 *   identity  - device Ed25519 key (sign readings / unlock requests)
 *   netclient - WiFi + NTP time
 *   backend   - readings upload + unlock handshake
 *   utils     - hex / JSON helpers
 */

#include <Arduino.h>

#include "backend.h"
#include "boxio.h"
#include "identity.h"
#include "netclient.h"
#include "secrets.h"

static unsigned long lastReadingAt = 0;

// Decides what a button press means for the current state.
static void onButtonPressed() {
  if (boxState() == BOX_UNLOCKED) {
    if (doorClosed()) {
      lockBox();
    } else {
      Serial.println("Cannot seal: door is open.");
    }
  } else {
    requestUnlock();
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Cold-chain secure box ===");

  boxBegin();

  if (!identityBegin()) {
    Serial.println("FATAL: DEVICE_PRIVATE_KEY_HEX must be 64 hex chars.");
    while (true) delay(1000);
  }
  Serial.printf("Device ID:   %s\n", DEVICE_ID);
  Serial.printf("Public key:  %s\n", devicePublicKeyHex().c_str());
  Serial.println("Register this device in the backoffice (POST /devices).\n");

  // Start UNLOCKED for loading. (See README: use a mechanically fail-secure
  // latch so a power loss in transit keeps the door shut.)
  unlockBox();

  netEnsureConnected();
  netBeginTime();
  backendKeyBegin();
}

void loop() {
  netEnsureConnected();

  if (buttonPressedEdge()) {
    onButtonPressed();
  }

  if (millis() - lastReadingAt >= READING_INTERVAL_MS) {
    lastReadingAt = millis();
    sendReading();
  }

  updateLeds();
}

