#pragma once

// The device's Ed25519 identity: signs readings and unlock requests so the
// backend can prove which physical box produced them.

#include <Arduino.h>

// Loads the device key from secrets and derives its public key.
// Returns false if DEVICE_PRIVATE_KEY_HEX is malformed.
bool identityBegin();

// Raw 32-byte device public key.
const uint8_t *devicePublicKey();

// Lowercase hex of the device public key (64 chars).
String devicePublicKeyHex();

// Signs len bytes of msg into out (must hold 64 bytes) with the device key.
void deviceSign(const uint8_t *msg, size_t len, uint8_t *out);

// Random 128-bit nonce as hex (replay protection for unlock requests).
String generateNonce();
