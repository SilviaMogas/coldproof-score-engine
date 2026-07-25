#include "boxio.h"

#include <OneWire.h>
#include <DallasTemperature.h>
#include <ESP32Servo.h>
#include <math.h>

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

void boxBegin() {
  pinMode(REED_GPIO, INPUT_PULLUP);
  pinMode(BUTTON_GPIO, INPUT_PULLUP);
  pinMode(LED_GREEN_GPIO, OUTPUT);
  pinMode(LED_RED_GPIO, OUTPUT);

  sensors.begin();

  latchServo.setPeriodHertz(50);
  latchServo.attach(SERVO_GPIO, 500, 2400);
}

BoxState boxState() { return state; }
void setBoxState(BoxState s) { state = s; }

void lockBox() {
  latchServo.write(SERVO_LOCK_ANGLE);
  state = BOX_LOCKED;
  Serial.println("Box SEALED (locked).");
}

void unlockBox() {
  latchServo.write(SERVO_UNLOCK_ANGLE);
  state = BOX_UNLOCKED;
  Serial.println("Box UNLOCKED.");
}

void denyFeedback() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED_GPIO, HIGH);
    delay(120);
    digitalWrite(LED_RED_GPIO, LOW);
    delay(120);
  }
}

bool doorClosed() {
  // Reed to GND with INPUT_PULLUP: closed door (magnet present) reads LOW.
  return digitalRead(REED_GPIO) == LOW;
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
    if (buttonStable == HIGH) return true;
  }
  return false;
}

float readTemperatureC() {
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C) return NAN;
  return tempC;
}
