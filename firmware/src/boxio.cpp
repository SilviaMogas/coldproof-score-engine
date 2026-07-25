#include "boxio.h"

#include <OneWire.h>
#include <DallasTemperature.h>
#include <ESP32Servo.h>
#include <math.h>

#include "log.h"
#include "secrets.h"

// DS18B20 probe.
static OneWire oneWire(DS18B20_GPIO);
static DallasTemperature sensors(&oneWire);

// Latch servo.
static Servo latchServo;

// Current box state.
static BoxState state = BOX_UNLOCKED;

// Button debounce.
static int buttonStable = LOW;
static int buttonLastRaw = LOW;
static unsigned long buttonDebounceAt = 0;

// Last observed door state, so we only log transitions.
static bool lastDoorClosed = false;
static bool doorInit = false;

// Last logged LED pattern, so we only log transitions (not every blink).
static BoxState lastLedState = BOX_UNLOCKED;
static bool ledInit = false;

const char *boxStateName(BoxState s) {
  switch (s) {
    case BOX_UNLOCKED:
      return "UNLOCKED";
    case BOX_LOCKED:
      return "LOCKED";
    case BOX_BREACH:
      return "BREACH";
  }
  return "?";
}

void boxBegin() {
  pinMode(REED_GPIO, INPUT_PULLUP);
  pinMode(BUTTON_GPIO, INPUT_PULLUP);
  pinMode(LED_GREEN_GPIO, OUTPUT);
  pinMode(LED_RED_GPIO, OUTPUT);
  LOGD("box", "gpio: reed=%d button=%d ledG=%d ledR=%d servo=%d probe=%d",
       REED_GPIO, BUTTON_GPIO, LED_GREEN_GPIO, LED_RED_GPIO, SERVO_GPIO,
       DS18B20_GPIO);

  sensors.begin();
  int probeCount = sensors.getDeviceCount();
  if (probeCount > 0) {
    LOGI("box", "DS18B20 probe(s) found: %d", probeCount);
  } else {
    LOGW("box", "no DS18B20 probe detected on GPIO %d", DS18B20_GPIO);
  }

  latchServo.setPeriodHertz(50);
  latchServo.attach(SERVO_GPIO, 500, 2400);
  LOGD("box", "servo attached (lock=%d deg, unlock=%d deg)", SERVO_LOCK_ANGLE,
       SERVO_UNLOCK_ANGLE);
}

BoxState boxState() { return state; }

void setBoxState(BoxState s) {
  if (s != state) {
    LOGI("box", "state %s -> %s", boxStateName(state), boxStateName(s));
  }
  state = s;
}

void lockBox() {
  latchServo.write(SERVO_LOCK_ANGLE);
  setBoxState(BOX_LOCKED);
  LOGI("box", "SEALED (latch locked at %d deg)", SERVO_LOCK_ANGLE);
}

void unlockBox() {
  latchServo.write(SERVO_UNLOCK_ANGLE);
  setBoxState(BOX_UNLOCKED);
  LOGI("box", "UNLOCKED (latch open at %d deg)", SERVO_UNLOCK_ANGLE);
}

void denyFeedback() {
  LOGD("box", "deny feedback (red blink x3)");
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED_GPIO, HIGH);
    delay(120);
    digitalWrite(LED_RED_GPIO, LOW);
    delay(120);
  }
}

bool doorClosed() {
  // Reed to GND with INPUT_PULLUP: closed door (magnet present) reads LOW.
  int level = digitalRead(REED_GPIO);
  bool closed = level == LOW;
  if (!doorInit || closed != lastDoorClosed) {
    LOGD("box", "reed: gpio%d=%s -> door %s", REED_GPIO,
         level == LOW ? "LOW" : "HIGH", closed ? "closed" : "open");
    lastDoorClosed = closed;
    doorInit = true;
  }
  return closed;
}

void updateLeds() {
  switch (state) {
    case BOX_UNLOCKED:
      digitalWrite(LED_GREEN_GPIO, HIGH);
      digitalWrite(LED_RED_GPIO, LOW);
      break;
    case BOX_LOCKED:
      digitalWrite(LED_GREEN_GPIO, LOW);
      digitalWrite(LED_RED_GPIO, HIGH);
      break;
    case BOX_BREACH:
      digitalWrite(LED_GREEN_GPIO, LOW);
      digitalWrite(LED_RED_GPIO, (millis() / 300) % 2 ? HIGH : LOW);
      break;
  }
  // Log the LED pattern once per state change (avoid spamming the breach blink).
  if (!ledInit || state != lastLedState) {
    switch (state) {
      case BOX_UNLOCKED:
        LOGD("box", "leds: green(gpio%d)=ON red(gpio%d)=OFF", LED_GREEN_GPIO,
             LED_RED_GPIO);
        break;
      case BOX_LOCKED:
        LOGD("box", "leds: green(gpio%d)=OFF red(gpio%d)=ON", LED_GREEN_GPIO,
             LED_RED_GPIO);
        break;
      case BOX_BREACH:
        LOGD("box", "leds: green(gpio%d)=OFF red(gpio%d)=BLINK", LED_GREEN_GPIO,
             LED_RED_GPIO);
        break;
    }
    lastLedState = state;
    ledInit = true;
  }
}

void boxLogStatus() {
  int reed = digitalRead(REED_GPIO);
  int btn = digitalRead(BUTTON_GPIO);
  const char *ledPattern;
  switch (state) {
    case BOX_UNLOCKED:
      ledPattern = "green=ON red=OFF";
      break;
    case BOX_LOCKED:
      ledPattern = "green=OFF red=ON";
      break;
    default:
      ledPattern = "green=OFF red=BLINK";
      break;
  }
  LOGD("box",
       "status: state=%s | reed(gpio%d)=%s door=%s | button(gpio%d)=%s | "
       "leds[%s]",
       boxStateName(state), REED_GPIO, reed == LOW ? "LOW" : "HIGH",
       reed == LOW ? "closed" : "open", BUTTON_GPIO,
       btn == LOW ? "LOW(rest)" : "HIGH(pressed)", ledPattern);
}

// Debounced edge detection for the normally-closed button. With INPUT_PULLUP
// the contact is closed at rest (reads LOW); pressing opens it (reads HIGH).
bool buttonPressedEdge() {
  int raw = digitalRead(BUTTON_GPIO);
  if (raw != buttonLastRaw) {
    buttonLastRaw = raw;
    buttonDebounceAt = millis();
  }
  if (millis() - buttonDebounceAt > 30 && raw != buttonStable) {
    buttonStable = raw;
    if (buttonStable == HIGH) {
      LOGD("box", "button: gpio%d=HIGH -> press (edge)", BUTTON_GPIO);
      return true;
    }
    LOGD("box", "button: gpio%d=LOW -> release", BUTTON_GPIO);
  }
  return false;
}

float readTemperatureC() {
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C) {
    LOGW("box", "probe read returned DISCONNECTED");
    return NAN;
  }
  LOGD("box", "probe read: %.2f C", tempC);
  return tempC;
}
