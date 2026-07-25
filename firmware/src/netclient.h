#pragma once

// WiFi connectivity and NTP-backed wall-clock time.

#include <Arduino.h>

// Connects to WiFi if not already connected (blocks until associated).
void netEnsureConnected();

// Configures NTP so epochSeconds() returns real time.
void netBeginTime();

// Current UNIX time in seconds, or 0 if NTP has not synced yet.
unsigned long epochSeconds();
