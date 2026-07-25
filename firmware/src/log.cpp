#include "log.h"

#include <stdarg.h>

void logPrintf(const char *level, const char *tag, const char *fmt, ...) {
  char msg[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(msg, sizeof(msg), fmt, args);
  va_end(args);

  // Right-align the timestamp so columns line up in the serial monitor.
  Serial.printf("[%8lu] %s %-5s %s\n", (unsigned long)millis(), level, tag,
                msg);
}
