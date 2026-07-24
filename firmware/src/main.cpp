/**
 * Cold-chain temperature sensor node (ESP32 + DS18B20).
 *
 * On each cycle the node:
 *   1. Reads the DS18B20 probe.
 *   2. Builds a canonical JSON reading string.
 *   3. Signs the exact bytes of that string with its Ed25519 device key.
 *   4. POSTs a signed envelope { message, publicKey, signature } to the gateway.
 *
 * The gateway verifies the signature and forwards the reading to Hedera HCS, so
 * the immutable log can prove which physical device produced each reading.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Crypto.h>
#include <Ed25519.h>
#include <time.h>

#include "secrets.h"

// DS18B20 on the configured GPIO.
static OneWire oneWire(DS18B20_GPIO);
static DallasTemperature sensors(&oneWire);

// Ed25519 key material for this device.
static uint8_t devicePrivateKey[32];
static uint8_t devicePublicKey[32];

static uint32_t sequenceNumber = 0;

// Forward declaration (defined at the bottom of the file).
String jsonString(const char *s);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Converts a hex string into raw bytes. Returns false on malformed input.
static bool hexToBytes(const char *hex, uint8_t *out, size_t outLen) {
  if (strlen(hex) != outLen * 2) return false;
  for (size_t i = 0; i < outLen; i++) {
    unsigned int b;
    if (sscanf(hex + i * 2, "%2x", &b) != 1) return false;
    out[i] = (uint8_t)b;
  }
  return true;
}

// Converts raw bytes into a lowercase hex string (out must hold len*2 + 1).
static void bytesToHex(const uint8_t *in, size_t len, char *out) {
  static const char *digits = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    out[i * 2] = digits[in[i] >> 4];
    out[i * 2 + 1] = digits[in[i] & 0x0F];
  }
  out[len * 2] = '\0';
}

static void connectWiFi() {
  Serial.printf("Connecting to WiFi \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());
}

// Returns current UNIX time in seconds, or 0 if NTP has not synced yet.
static unsigned long epochSeconds() {
  time_t now = time(nullptr);
  return (now < 100000) ? 0UL : (unsigned long)now;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Cold-chain sensor node ===");

  sensors.begin();

  if (!hexToBytes(DEVICE_PRIVATE_KEY_HEX, devicePrivateKey, 32)) {
    Serial.println("FATAL: DEVICE_PRIVATE_KEY_HEX must be 64 hex chars.");
    while (true) delay(1000);
  }
  Ed25519::derivePublicKey(devicePublicKey, devicePrivateKey);

  char pubHex[65];
  bytesToHex(devicePublicKey, 32, pubHex);
  Serial.printf("Device ID:   %s\n", DEVICE_ID);
  Serial.printf("Public key:  %s\n", pubHex);
  Serial.println("Add this public key to DEVICE_PUBLIC_KEYS in the gateway .env.\n");

  connectWiFi();

  // NTP so readings carry a real timestamp.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);

  if (tempC == DEVICE_DISCONNECTED_C) {
    Serial.println("Sensor read failed (probe disconnected?). Retrying...");
    delay(READING_INTERVAL_MS);
    return;
  }

  sequenceNumber++;

  // Build the canonical reading string. These exact bytes are what we sign and
  // send; the gateway verifies the signature over this same string.
  char message[256];
  snprintf(message, sizeof(message),
           "{\"deviceId\":\"%s\",\"seq\":%lu,\"temperatureC\":%.2f,"
           "\"unit\":\"C\",\"ts\":%lu}",
           DEVICE_ID, (unsigned long)sequenceNumber, tempC, epochSeconds());

  // Sign the message bytes.
  uint8_t signature[64];
  Ed25519::sign(signature, devicePrivateKey, devicePublicKey,
                (const uint8_t *)message, strlen(message));

  char sigHex[129];
  char pubHex[65];
  bytesToHex(signature, 64, sigHex);
  bytesToHex(devicePublicKey, 32, pubHex);

  // Build the signed envelope. The message is embedded as a raw JSON string so
  // the gateway can re-verify the exact signed bytes.
  String body = String("{\"message\":") + jsonString(message) +
                ",\"publicKey\":\"" + pubHex + "\"" +
                ",\"signature\":\"" + sigHex + "\"}";

  Serial.printf("#%lu  %.2f C  -> POST %s\n",
                (unsigned long)sequenceNumber, tempC, GATEWAY_URL);

  HTTPClient http;
  http.begin(GATEWAY_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  if (code > 0) {
    Serial.printf("  gateway %d: %s\n", code, http.getString().c_str());
  } else {
    Serial.printf("  POST failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();

  delay(READING_INTERVAL_MS);
}

// Wraps a raw string as a JSON string literal (escaping quotes and backslashes).
String jsonString(const char *s) {
  String out = "\"";
  for (const char *p = s; *p; p++) {
    if (*p == '"' || *p == '\\') out += '\\';
    out += *p;
  }
  out += "\"";
  return out;
}
