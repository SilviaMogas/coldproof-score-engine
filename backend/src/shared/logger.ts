import pino, { type Logger } from "pino";

export interface LoggerOptions {
  level: string;
  /** When true, emit colorized, human-readable logs (dev). Otherwise JSON. */
  pretty: boolean;
}

/**
 * Creates the application logger. In pretty mode it colorizes by level for
 * local development; in production it emits structured JSON for log pipelines.
 */
export function createLogger({ level, pretty }: LoggerOptions): Logger {
  if (pretty) {
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino({ level });
}

export type { Logger };
