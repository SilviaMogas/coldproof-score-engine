import type { Env } from "../config/env.js";
import type { CommandSigner } from "../application/ports/command-signer.js";
import { Ed25519CommandSigner } from "../infrastructure/crypto/ed25519-command-signer.js";

/** Minimal logger shape used to warn about ephemeral keys. */
interface CommandSignerLogger {
  warn(obj: unknown, msg?: string): void;
}

/**
 * Builds the command signer used to authorize box unlocks. When
 * `UNLOCK_SIGNING_KEY` is set the key is stable across restarts; otherwise a
 * fresh ephemeral key is generated (dev only) and a warning is emitted, since
 * provisioned devices would then reject its signatures.
 */
export function createCommandSigner(
  env: Env,
  logger?: CommandSignerLogger
): CommandSigner {
  if (!env.UNLOCK_SIGNING_KEY) {
    logger?.warn(
      {},
      "UNLOCK_SIGNING_KEY not set; using an ephemeral unlock key (changes on restart)"
    );
    return new Ed25519CommandSigner();
  }
  return new Ed25519CommandSigner(env.UNLOCK_SIGNING_KEY);
}
