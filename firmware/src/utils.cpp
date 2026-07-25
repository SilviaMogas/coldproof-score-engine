#include "utils.h"

bool hexToBytes(const char *hex, uint8_t *out, size_t outLen) {
  if (strlen(hex) != outLen * 2) return false;
  for (size_t i = 0; i < outLen; i++) {
    unsigned int b;
    if (sscanf(hex + i * 2, "%2x", &b) != 1) return false;
    out[i] = (uint8_t)b;
  }
  return true;
}

void bytesToHex(const uint8_t *in, size_t len, char *out) {
  static const char *digits = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    out[i * 2] = digits[in[i] >> 4];
    out[i * 2 + 1] = digits[in[i] & 0x0F];
  }
  out[len * 2] = '\0';
}

bool isAllZeroHex(const char *hex) {
  for (const char *p = hex; *p; p++) {
    if (*p != '0') return false;
  }
  return true;
}

String jsonString(const char *s) {
  String out = "\"";
  for (const char *p = s; *p; p++) {
    if (*p == '"' || *p == '\\') out += '\\';
    out += *p;
  }
  out += "\"";
  return out;
}
