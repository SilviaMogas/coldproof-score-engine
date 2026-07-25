#pragma once

// Physical box I/O: state, servo latch, status LEDs, door reed switch,
// unlock button and the temperature probe.

#include <Arduino.h>

enum BoxState { BOX_UNLOCKED, BOX_LOCKED, BOX_BREACH };

// Configures GPIOs, the latch servo and the temperature sensor.
void boxBegin();

BoxState boxState();
void setBoxState(BoxState s);

// Latch control (also updates the box state).
void lockBox();
void unlockBox();

// Brief red blink to signal a denied unlock.
void denyFeedback();

// True when the door is shut (reed magnet present).
bool doorClosed();

// Drives the status LEDs from the current state; call every loop.
void updateLeds();

// Returns true once per debounced button press.
bool buttonPressedEdge();

// Reads the probe in Celsius. Returns NAN if the probe is disconnected.
float readTemperatureC();
