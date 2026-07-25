#pragma once

// Small stateless helpers for hex encoding and JSON string escaping.

#include <Arduino.h>

// Converts a hex string into raw bytes. Returns false on malformed input.
bool hexToBytes(const char *hex, uint8_t *out, size_t outLen);

// Converts raw bytes into a lowercase hex string (out must hold len*2 + 1).
void bytesToHex(const uint8_t *in, size_t len, char *out);

// True when a hex string is all zeros (our "not set" sentinel).
bool isAllZeroHex(const char *hex);

// Wraps a raw string as a JSON string literal (escaping quotes/backslashes).
String jsonString(const char *s);
