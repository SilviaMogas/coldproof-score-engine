#include "backend.h"

#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Crypto.h>
#include <Ed25519.h>
#include <math.h>

#include "boxio.h"
#include "config.h"
#include "identity.h"
#include "log.h"
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
    LOGI("bk", "backend unlock key pinned from secrets.h");
  } else {
    LOGD("bk", "no pinned backend key; fetching from %s", UNLOCK_PUBKEY_URL);
    backendKeyLoaded = fetchBackendPublicKey();
  }
}

void sendReading() {
  float tempC = readTemperatureC();
  if (isnan(tempC)) {
    LOGW("rd", "sensor read failed (probe disconnected?); skipping upload");
    return;
  }

  // Local breach feedback: once breached in transit, the box shows RED blink
  // and stays shut. The backend independently records and enforces this.
  if ((tempC < TEMP_MIN_C || tempC > TEMP_MAX_C) && boxState() == BOX_LOCKED) {
    LOGW("rd", "TEMPERATURE BREACH: %.2f C out of [%.1f, %.1f]", tempC,
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

  LOGI("rd", "#%lu %.2f C -> POST %s", (unsigned long)sequenceNumber, tempC,
       READINGS_URL);
  LOGD("rd", "signed message: %s", message);
  LOGD("rd", "signature: %.16s... (%d bytes hex)", sigHex, 128);

  HTTPClient http;
  http.begin(READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  unsigned long startedAt = millis();
  int code = http.POST(body);
  unsigned long took = millis() - startedAt;

  if (code > 0) {
    String resp = http.getString();
    if (code >= 200 && code < 300) {
      LOGI("rd", "  <- %d in %lu ms", code, took);
    } else {
      LOGW("rd", "  <- %d in %lu ms: %s", code, took, resp.c_str());
    }
  } else {
    LOGE("rd", "  POST failed in %lu ms: %s", took,
         http.errorToString(code).c_str());
  }
  http.end();
}

void requestUnlock() {
  LOGI("ul", "unlock requested -> asking backend %s", UNLOCK_URL);

  if (!backendKeyLoaded) {
    LOGD("ul", "backend key not loaded; fetching now");
    backendKeyLoaded = fetchBackendPublicKey();
    if (!backendKeyLoaded) {
      LOGE("ul", "no backend key; cannot verify unlock. staying locked");
      denyFeedback();
      return;
    }
  }

  String nonce = generateNonce();
  LOGD("ul", "generated nonce: %s", nonce.c_str());

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
  LOGD("ul", "signed request: %s", message);

  HTTPClient http;
  http.begin(UNLOCK_URL);
  http.addHeader("Content-Type", "application/json");
  unsigned long startedAt = millis();
  int code = http.POST(body);
  LOGD("ul", "  <- HTTP %d in %lu ms", code, millis() - startedAt);

  if (code != 200) {
    String resp = code > 0 ? http.getString() : http.errorToString(code);
    LOGW("ul", "  unlock HTTP %d: %s", code, resp.c_str());
    http.end();
    denyFeedback();
    return;
  }

  String resp = http.getString();
  http.end();
  LOGD("ul", "  response: %s", resp.c_str());

  JsonDocument doc;
  if (deserializeJson(doc, resp)) {
    LOGE("ul", "  bad unlock response JSON");
    denyFeedback();
    return;
  }

  bool authorized = doc["authorized"] | false;
  if (!authorized) {
    const char *reason = doc["reason"] | "denied";
    LOGW("ul", "  unlock DENIED by backend: %s", reason);
    denyFeedback();
    return;
  }

  String command = doc["command"].as<String>();
  String sig = doc["signature"].as<String>();
  LOGD("ul", "  verifying signed command (%d bytes)", command.length());

  if (verifyUnlockCommand(command, sig, nonce)) {
    LOGI("ul", "  unlock AUTHORIZED (signature verified). opening");
    unlockBox();
  } else {
    LOGE("ul", "  unlock command failed verification. staying locked");
    denyFeedback();
  }
}

// Verifies the backend-signed unlock command and its bound fields.
static bool verifyUnlockCommand(const String &command, const String &sigHex,
                                const String &expectedNonce) {
  uint8_t sig[64];
  if (!hexToBytes(sigHex.c_str(), sig, 64)) {
    LOGE("ul", "  command signature is not 64 bytes of hex");
    return false;
  }
  if (!Ed25519::verify(sig, backendPublicKey, command.c_str(),
                       command.length())) {
    LOGE("ul", "  command signature INVALID");
    return false;
  }

  JsonDocument doc;
  if (deserializeJson(doc, command)) {
    LOGE("ul", "  command JSON malformed");
    return false;
  }

  const char *devId = doc["deviceId"];
  const char *action = doc["action"];
  const char *nonce = doc["nonce"];
  unsigned long exp = doc["exp"] | 0UL;

  if (!devId || strcmp(devId, DEVICE_ID) != 0) {
    LOGE("ul", "  command deviceId mismatch (got %s)", devId ? devId : "null");
    return false;
  }
  if (!action || strcmp(action, "unlock") != 0) {
    LOGE("ul", "  command action is not 'unlock' (got %s)",
         action ? action : "null");
    return false;
  }
  if (!nonce || expectedNonce != nonce) {
    LOGE("ul", "  command nonce mismatch (possible replay)");
    return false;
  }

  unsigned long now = epochSeconds();
  if (now > 0 && exp > 0 && exp < now) {
    LOGE("ul", "  command expired (exp=%lu now=%lu)", exp, now);
    return false;
  }

  LOGD("ul", "  command checks passed (deviceId, action, nonce, exp)");
  return true;
}

// Fetches the backend unlock public key from the API (dev convenience).
static bool fetchBackendPublicKey() {
  HTTPClient http;
  http.begin(UNLOCK_PUBKEY_URL);
  unsigned long startedAt = millis();
  int code = http.GET();
  bool ok = false;

  if (code == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, http.getString())) {
      const char *pk = doc["publicKey"];
      if (pk && hexToBytes(pk, backendPublicKey, 32)) {
        ok = true;
        LOGI("bk", "fetched backend unlock key: %s (%lu ms)", pk,
             millis() - startedAt);
      } else {
        LOGE("bk", "backend key response missing/invalid publicKey");
      }
    } else {
      LOGE("bk", "backend key response JSON malformed");
    }
  } else {
    LOGW("bk", "fetch backend key HTTP %d", code);
  }

  http.end();
  return ok;
}
