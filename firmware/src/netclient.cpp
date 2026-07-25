#include "netclient.h"

#include <WiFi.h>
#include <time.h>

#include "log.h"
#include "secrets.h"

void netEnsureConnected() {
  if (WiFi.status() == WL_CONNECTED) return;

  LOGI("net", "connecting to WiFi \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    LOGD("net", "  ...status=%d elapsed=%lu ms", WiFi.status(),
         millis() - startedAt);
  }
  LOGI("net", "connected ip=%s rssi=%d dBm in %lu ms",
       WiFi.localIP().toString().c_str(), WiFi.RSSI(), millis() - startedAt);
}

void netBeginTime() {
  LOGI("net", "syncing time via NTP (pool.ntp.org)");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  // Best-effort wait so the first reading carries a real epoch timestamp.
  unsigned long startedAt = millis();
  while (epochSeconds() == 0 && millis() - startedAt < 5000) {
    delay(250);
  }
  unsigned long now = epochSeconds();
  if (now > 0) {
    LOGI("net", "time synced: epoch=%lu (%lu ms)", now, millis() - startedAt);
  } else {
    LOGW("net", "time not synced yet; readings may carry ts=0 for now");
  }
}

unsigned long epochSeconds() {
  time_t now = time(nullptr);
  return (now < 100000) ? 0UL : (unsigned long)now;
}
