import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_PRETTY: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),

  PERSISTENCE: z.enum(["memory", "sqlite"]).default("memory"),
  SQLITE_PATH: z.string().min(1).default("./data/coldproof.db"),

  COGNITO_REGION: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_CLIENT_ID: z.string().min(1),
  COGNITO_TOKEN_USE: z.enum(["access", "id"]).default("access"),

  // Hedera Consensus Service. When operator credentials are omitted, readings
  // are persisted but not mirrored to HCS (a no-op log is used).
  HEDERA_NETWORK: z
    .enum(["testnet", "previewnet", "mainnet"])
    .default("testnet"),
  HEDERA_OPERATOR_ID: z.string().optional(),
  HEDERA_OPERATOR_KEY: z.string().optional(),
  HEDERA_TOPIC_ID: z.string().optional(),

  // Secure-box unlock authorization. The backend signs unlock commands with
  // this Ed25519 seed (32-byte hex); devices verify with the matching key. If
  // omitted, an ephemeral key is generated (dev only). Unlock is refused when a
  // reading breached [TEMP_MIN_C, TEMP_MAX_C]; commands expire after the TTL.
  UNLOCK_SIGNING_KEY: z.string().optional(),
  UNLOCK_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  TEMP_MIN_C: z.coerce.number().default(2),
  TEMP_MAX_C: z.coerce.number().default(8),
});

export type Env = z.infer<typeof schema>;

/**
 * Loads and validates environment configuration. Fails fast with a readable
 * message if anything required is missing or malformed.
 */
export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
