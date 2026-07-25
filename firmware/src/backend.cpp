#include "backend.h"

#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Crypto.h>
#include <Ed25519.h>
#include <math.h>

#include "boxio.h"
#include "config.h"
#include "identity.h"
#include "netclient.h"
#include "secrets.h"
#include "utils.h"

// Backend public key used to verify unlock commands.
static uint8_t backendPublicKey[32];
static bool backendKeyLoaded = false;

static uint32_t sequenceNumber = 0;

static bool fetchBackendPublicKey();
static bool verifyUnlockCommand(const String &command, const String &sigHex,
                                const String &expectedNonce);

void backendKeyBegin() {
  if (!isAllZeroHex(BACKEND_PUBLIC_KEY_HEX) &&
      hexToBytes(BACKEND_PUBLIC_KEY_HEX, backendPublicKey, 32)) {
    backendKeyLoaded = true;
    Serial.println("Backend unlock key: pinned from secrets.h");
  } else {
    backendKeyLoaded = fetchBackendPublicKey();
  }
}

void sendReading() {
  float tempC = readTemperatureC();
  if (isnan(tempC)) {
    Serial.println("Sensor read failed (probe disconnected?).");
    return;
  }

  // Local breach feedback: once breached in transit, the box shows RED blink
  // and stays shut. The backend independently records and enforces this.
  if ((tempC < TEMP_MIN_C || tempC > TEMP_MAX_C) && boxState() == BOX_LOCKED) {
    Serial.printf("TEMPERATURE BREACH: %.2f C out of [%.1f, %.1f]\n", tempC,
                  (float)TEMP_MIN_C, (float)TEMP_MAX_C);
    setBoxState(BOX_BREACH);
  }

  sequenceNumber++;

  // Canonical reading string. These exact bytes are what we sign and send.
  char message[256];
  snprintf(message, sizeof(message),
           "{\"deviceId\":\"%s\",\"seq\":%lu,\"temperatureC\":%.2f,"
           "\"unit\":\"C\",\"ts\":%lu}",
           DEVICE_ID, (unsigned long)sequenceNumber, tempC, epochSeconds());

  uint8_t signature[64];
  deviceSign((const uint8_t *)message, strlen(message), signature);

  char sigHex[129];
  bytesToHex(signature, 64, sigHex);

  String body = String("{\"message\":") + jsonString(message) +
                ",\"publicKey\":\"" + devicePublicKeyHex() + "\"" +
                ",\"signature\":\"" + sigHex + "\"}";

  Serial.printf("#%lu  %.2f C  -> POST %s\n", (unsigned long)sequenceNumber,
                tempC, READINGS_URL);

  HTTPClient http;
  http.begin(READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  if (code > 0) {
    Serial.printf("  readings %d\n", code);
  } else {
    Serial.printf("  POST failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

void requestUnlock() {
  Serial.println("Unlock requested -> asking backend...");

  if (!backendKeyLoaded) {
    backendKeyLoaded = fetchBackendPublicKey();
    if (!backendKeyLoaded) {
      Serial.println("  no backend key; cannot verify unlock. Staying locked.");
      denyFeedback();
      return;
    }
  }

  String nonce = generateNonce();

  char message[192];
  snprintf(message, sizeof(message),
           "{\"deviceId\":\"%s\",\"nonce\":\"%s\",\"ts\":%lu}", DEVICE_ID,
           nonce.c_str(), epochSeconds());

  uint8_t signature[64];
  deviceSign((const uint8_t *)message, strlen(message), signature);

  char sigHex[129];
  bytesToHex(signature, 64, sigHex);

  String body = String("{\"message\":") + jsonString(message) +
                ",\"publicKey\":\"" + devicePublicKeyHex() + "\"" +
                ",\"signature\":\"" + sigHex + "\"}";

  HTTPClient http;
  http.begin(UNLOCK_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);

  if (code != 200) {
    Serial.printf("  unlock HTTP %d\n", code);
    http.end();
    denyFeedback();
    return;
  }

  String resp = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, resp)) {
    Serial.println("  bad unlock response JSON");
    denyFeedback();
    return;
  }

  bool authorized = doc["authorized"] | false;
  if (!authorized) {
    const char *reason = doc["reason"] | "denied";
    Serial.printf("  unlock DENIED: %s\n", reason);
    denyFeedback();
    return;
  }

  String command = doc["command"].as<String>();
  String sig = doc["signature"].as<String>();

  if (verifyUnlockCommand(command, sig, nonce)) {
    Serial.println("  unlock AUTHORIZED (signature verified). Opening.");
    unlockBox();
  } else {
    Serial.println("  unlock command failed verification. Staying locked.");
    denyFeedback();
  }
}

// Verifies the backend-signed unlock command and its bound fields.
static bool verifyUnlockCommand(const String &command, const String &sigHex,
                                const String &expectedNonce) {
  uint8_t sig[64];
  if (!hexToBytes(sigHex.c_str(), sig, 64)) {
    return false;
  }
  if (!Ed25519::verify(sig, backendPublicKey, command.c_str(),
                       command.length())) {
    Serial.println("  command signature INVALID");
    return false;
  }

  JsonDocument doc;
  if (deserializeJson(doc, command)) {
    return false;
  }

  const char *devId = doc["deviceId"];
  const char *action = doc["action"];
  const char *nonce = doc["nonce"];
  unsigned long exp = doc["exp"] | 0UL;

  if (!devId || strcmp(devId, DEVICE_ID) != 0) {
    Serial.println("  command deviceId mismatch");
    return false;
  }
  if (!action || strcmp(action, "unlock") != 0) {
    Serial.println("  command action is not 'unlock'");
    return false;
  }
  if (!nonce || expectedNonce != nonce) {
    Serial.println("  command nonce mismatch (possible replay)");
    return false;
  }

  unsigned long now = epochSeconds();
  if (now > 0 && exp > 0 && exp < now) {
    Serial.println("  command expired");
    return false;
  }

  return true;
}

// Fetches the backend unlock public key from the API (dev convenience).
static bool fetchBackendPublicKey() {
  HTTPClient http;
  http.begin(UNLOCK_PUBKEY_URL);
  int code = http.GET();
  bool ok = false;

  if (code == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, http.getString())) {
      const char *pk = doc["publicKey"];
      if (pk && hexToBytes(pk, backendPublicKey, 32)) {
        ok = true;
        Serial.printf("Backend unlock key: fetched %s\n", pk);
      }
    }
  } else {
    Serial.printf("  fetch backend key HTTP %d\n", code);
  }

  http.end();
  return ok;
}
