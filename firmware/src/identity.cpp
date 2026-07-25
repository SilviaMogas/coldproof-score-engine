#include "identity.h"

#include <Crypto.h>
#include <Ed25519.h>

#include "log.h"
#include "secrets.h"
#include "utils.h"

static uint8_t privateKey[32];
static uint8_t publicKey[32];

bool identityBegin() {
  if (!hexToBytes(DEVICE_PRIVATE_KEY_HEX, privateKey, 32)) {
    LOGE("id", "DEVICE_PRIVATE_KEY_HEX is not 64 hex chars");
    return false;
  }
  Ed25519::derivePublicKey(publicKey, privateKey);
  LOGD("id", "Ed25519 keypair loaded and public key derived");
  return true;
}

const uint8_t *devicePublicKey() { return publicKey; }

String devicePublicKeyHex() {
  char hex[65];
  bytesToHex(publicKey, 32, hex);
  return String(hex);
}

void deviceSign(const uint8_t *msg, size_t len, uint8_t *out) {
  Ed25519::sign(out, privateKey, publicKey, msg, len);
}

String generateNonce() {
  char buf[17];
  snprintf(buf, sizeof(buf), "%08x%08x", (unsigned)esp_random(),
           (unsigned)esp_random());
  return String(buf);
}
