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
#include "config.h"
#include "identity.h"
#include "log.h"
#include "netclient.h"
#include "secrets.h"

static unsigned long lastReadingAt = 0;

// Decides what a button press means for the current state.
static void onButtonPressed() {
  LOGD("box", "button pressed while state=%s door=%s", boxStateName(boxState()),
       doorClosed() ? "closed" : "open");
  if (boxState() == BOX_UNLOCKED) {
    if (!doorClosed()) {
      LOGW("box", "cannot seal: door is open");
      return;
    }
    // Only seal once the backend confirms a delivery started; otherwise the box
    // would sit LOCKED with no active trip and every unlock would be denied.
    if (sealDelivery()) {
      lockBox();
    } else {
      LOGW("box", "seal rejected by backend; staying unlocked");
      denyFeedback();
    }
  } else {
    requestUnlock();
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  LOGI("boot", "=== Cold-chain secure box ===");
  LOGI("boot", "firmware build %s %s", __DATE__, __TIME__);
  LOGD("boot", "log level=%d, reading interval=%lu ms, range=[%.1f, %.1f] C",
       LOG_LEVEL, (unsigned long)READING_INTERVAL_MS, (float)TEMP_MIN_C,
       (float)TEMP_MAX_C);
  LOGD("boot", "endpoints readings=%s unlock=%s", READINGS_URL, UNLOCK_URL);

  boxBegin();

  if (!identityBegin()) {
    LOGE("boot", "FATAL: DEVICE_PRIVATE_KEY_HEX must be 64 hex chars");
    while (true) delay(1000);
  }
  LOGI("id", "device id:  %s", DEVICE_ID);
  LOGI("id", "public key: %s", devicePublicKeyHex().c_str());
  LOGI("id", "register this device in the backoffice (POST /devices)");

  // Start UNLOCKED for loading. (See README: use a mechanically fail-secure
  // latch so a power loss in transit keeps the door shut.)
  unlockBox();

  netEnsureConnected();
  netBeginTime();
  backendKeyBegin();
  LOGI("boot", "setup complete, entering main loop");
}

void loop() {
  netEnsureConnected();

  boxProcessEvents();

  if (buttonPressedEdge()) {
    onButtonPressed();
  }

  if (millis() - lastReadingAt >= READING_INTERVAL_MS) {
    lastReadingAt = millis();
    boxLogStatus();
    // Only report temperatures while the box is sealed and in transit
    // (LOCKED/BREACH). When UNLOCKED it is loading or already delivered, so a
    // reading carries no cold-chain meaning.
    if (boxState() != BOX_UNLOCKED) {
      sendReading();
    } else {
      LOGD("rd", "box UNLOCKED (not in transit); skipping reading upload");
    }
  }

  updateLeds();
}

