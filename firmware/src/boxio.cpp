#include "boxio.h"

#include <OneWire.h>
#include <DallasTemperature.h>
#include <ESP32Servo.h>
#include <Ticker.h>
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

// Button is normally-open to GND with INPUT_PULLUP, so it reads HIGH at rest
// and LOW while pressed. A change interrupt tracks the real level on every edge
// (buttonDown) and latches one press per push, with a lockout that rejects
// bounce and accidental double-taps. Because buttonDown always mirrors the pin,
// the state machine can never deadlock even if a release edge bounces.
static volatile bool buttonPressPending = false;
static volatile bool buttonDown = false;
static volatile unsigned long lastButtonPressMs = 0;
static volatile unsigned long lastButtonEdgeMs = 0;

// Reed change interrupt: flags that the door state moved so loop() logs the
// transition even while an HTTP request is in flight.
static volatile bool doorEventPending = false;
static volatile unsigned long lastReedIsrMs = 0;

// Timer that blinks the red LED during BREACH, independent of loop() timing.
static Ticker breachTicker;

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

// --- Interrupt service routines (kept minimal; no logging/allocation here) ---

static void IRAM_ATTR buttonIsr() {
  unsigned long now = millis();
  bool low = digitalRead(BUTTON_GPIO) == LOW;
  if (low && !buttonDown) {
    buttonDown = true;
    // Latch a press only when the line has been quiet for a bounce window (so
    // release-bounce after a long hold is not seen as a new press) and we are
    // past the repeat lockout of the previous accepted press.
    if (now - lastButtonEdgeMs > 50 && now - lastButtonPressMs > 200) {
      buttonPressPending = true;
      lastButtonPressMs = now;
    }
  } else if (!low && buttonDown) {
    // Release edge: always re-sync so a new press can be accepted later.
    buttonDown = false;
  }
  lastButtonEdgeMs = now;
}

static void IRAM_ATTR reedIsr() {
  unsigned long now = millis();
  if (now - lastReedIsrMs < 20) return;
  lastReedIsrMs = now;
  doorEventPending = true;
}

// Blink callback fired by the Ticker (runs in the esp_timer task, not an ISR).
static void breachBlinkTick() {
  static bool on = false;
  on = !on;
  digitalWrite(LED_RED_GPIO, on ? HIGH : LOW);
}

void boxBegin() {
  pinMode(REED_GPIO, INPUT_PULLUP);
  pinMode(BUTTON_GPIO, INPUT_PULLUP);
  pinMode(LED_GREEN_GPIO, OUTPUT);
  pinMode(LED_RED_GPIO, OUTPUT);
  LOGD("box", "gpio: reed=%d button=%d ledG=%d ledR=%d servo=%d probe=%d",
       REED_GPIO, BUTTON_GPIO, LED_GREEN_GPIO, LED_RED_GPIO, SERVO_GPIO,
       DS18B20_GPIO);

  // Button press/release and reed changes both run on CHANGE interrupts.
  attachInterrupt(digitalPinToInterrupt(BUTTON_GPIO), buttonIsr, CHANGE);
  attachInterrupt(digitalPinToInterrupt(REED_GPIO), reedIsr, CHANGE);
  LOGD("box", "interrupts attached (button CHANGE, reed CHANGE)");

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
  // Act only on state changes; the breach blink is driven by the Ticker so it
  // keeps blinking even while loop() is blocked on a network call.
  if (ledInit && state == lastLedState) return;
  lastLedState = state;
  ledInit = true;
  breachTicker.detach();
  switch (state) {
    case BOX_UNLOCKED:
      digitalWrite(LED_GREEN_GPIO, HIGH);
      digitalWrite(LED_RED_GPIO, LOW);
      LOGD("box", "leds: green(gpio%d)=ON red(gpio%d)=OFF", LED_GREEN_GPIO,
           LED_RED_GPIO);
      break;
    case BOX_LOCKED:
      digitalWrite(LED_GREEN_GPIO, LOW);
      digitalWrite(LED_RED_GPIO, HIGH);
      LOGD("box", "leds: green(gpio%d)=OFF red(gpio%d)=ON", LED_GREEN_GPIO,
           LED_RED_GPIO);
      break;
    case BOX_BREACH:
      digitalWrite(LED_GREEN_GPIO, LOW);
      digitalWrite(LED_RED_GPIO, HIGH);
      breachTicker.attach_ms(300, breachBlinkTick);
      LOGD("box", "leds: green(gpio%d)=OFF red(gpio%d)=BLINK", LED_GREEN_GPIO,
           LED_RED_GPIO);
      break;
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
       btn == LOW ? "LOW(pressed)" : "HIGH(rest)", ledPattern);
}

// Debounced edge detection for the normally-open button. The falling-edge ISR
// sets buttonPressPending; here we just consume it (safe to log in loop ctx).
bool buttonPressedEdge() {
  if (buttonPressPending) {
    buttonPressPending = false;
    LOGD("box", "button: gpio%d=LOW -> press (edge, irq)", BUTTON_GPIO);
    return true;
  }
  return false;
}

// Handles the reed change interrupt: logs the door transition. Call from loop.
void boxProcessEvents() {
  if (doorEventPending) {
    doorEventPending = false;
    doorClosed();  // reads the pin and logs the closed/open transition
  }
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
