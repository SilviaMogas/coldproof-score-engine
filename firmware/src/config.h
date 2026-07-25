#pragma once

// Backend endpoints, derived from the API base in secrets.h at compile time.
#include "secrets.h"

#define READINGS_URL      API_BASE_URL "/readings"
#define UNLOCK_URL        API_BASE_URL "/unlock"
#define UNLOCK_PUBKEY_URL API_BASE_URL "/unlock/public-key"
