#include "netclient.h"

#include <WiFi.h>
#include <time.h>

#include "secrets.h"

void netEnsureConnected() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("Connecting to WiFi \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());
}

void netBeginTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

unsigned long epochSeconds() {
  time_t now = time(nullptr);
  return (now < 100000) ? 0UL : (unsigned long)now;
}
