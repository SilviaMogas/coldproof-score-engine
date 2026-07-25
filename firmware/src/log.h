#pragma once

// Tiny leveled logger for the secure box firmware.
//
// Every line is prefixed with a millis() timestamp, a level and a short tag so
// the serial trace is easy to follow and grep:
//
//   [   1234] INFO  net   connected ip=192.168.1.42 rssi=-58 dBm
//   [   1250] DEBUG box   button edge: press
//
// Set the verbosity at build time with -DLOG_LEVEL=<n> in platformio.ini:
//   0=silent 1=error 2=warn 3=info 4=debug (default). Higher includes lower.

#include <Arduino.h>

#define LOG_LEVEL_NONE 0
#define LOG_LEVEL_ERROR 1
#define LOG_LEVEL_WARN 2
#define LOG_LEVEL_INFO 3
#define LOG_LEVEL_DEBUG 4

#ifndef LOG_LEVEL
#define LOG_LEVEL LOG_LEVEL_DEBUG
#endif

// Internal: prints the "[ms] LVL tag msg\n" line. Use the macros below.
void logPrintf(const char *level, const char *tag, const char *fmt, ...);

#define LOGE(tag, ...)                                                          \
  do {                                                                         \
    if (LOG_LEVEL >= LOG_LEVEL_ERROR) logPrintf("ERROR", tag, __VA_ARGS__);    \
  } while (0)

#define LOGW(tag, ...)                                                          \
  do {                                                                         \
    if (LOG_LEVEL >= LOG_LEVEL_WARN) logPrintf("WARN ", tag, __VA_ARGS__);     \
  } while (0)

#define LOGI(tag, ...)                                                          \
  do {                                                                         \
    if (LOG_LEVEL >= LOG_LEVEL_INFO) logPrintf("INFO ", tag, __VA_ARGS__);     \
  } while (0)

#define LOGD(tag, ...)                                                          \
  do {                                                                         \
    if (LOG_LEVEL >= LOG_LEVEL_DEBUG) logPrintf("DEBUG", tag, __VA_ARGS__);    \
  } while (0)
