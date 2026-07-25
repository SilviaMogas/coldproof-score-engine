#pragma once

// Talks to the cold-chain backend: uploads signed readings and runs the
// server-authoritative unlock handshake.

#include <Arduino.h>

// Loads the backend unlock public key (pinned in secrets, else fetched).
void backendKeyBegin();

// Reads the probe, updates breach state, then signs and uploads a reading.
void sendReading();

// Runs the full unlock handshake; opens the box only on a verified command.
void requestUnlock();

// Notifies the backend that the box was sealed, starting its delivery.
// Returns true if the backend confirmed the delivery is in transit.
bool sealDelivery();
