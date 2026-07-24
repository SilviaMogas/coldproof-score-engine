import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Reading } from "../../domain/reading/reading.js";
import type { ReadingRepository } from "../../domain/reading/reading-repository.js";

interface ReadingRow {
  id: string;
  device_id: string;
  seq: number;
  temperature_c: number;
  unit: string;
  ts: number;
  public_key: string;
  signature: string;
  received_at: string;
}

function toReading(row: ReadingRow): Reading {
  return {
    id: row.id,
    deviceId: row.device_id,
    seq: row.seq,
    temperatureC: row.temperature_c,
    unit: row.unit,
    ts: row.ts,
    publicKey: row.public_key,
    signature: row.signature,
    receivedAt: new Date(row.received_at),
  };
}

/**
 * SQLite-backed reading store using better-sqlite3 (synchronous driver). The
 * schema is created on construction, so the file is ready to use immediately.
 */
export class SqliteReadingRepository implements ReadingRepository {
  private readonly db: Database.Database;

  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id            TEXT PRIMARY KEY,
        device_id     TEXT NOT NULL,
        seq           INTEGER NOT NULL,
        temperature_c REAL NOT NULL,
        unit          TEXT NOT NULL,
        ts            INTEGER NOT NULL,
        public_key    TEXT NOT NULL,
        signature     TEXT NOT NULL,
        received_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_readings_device
        ON readings (device_id, received_at DESC);
    `);
  }

  async save(reading: Reading): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO readings
           (id, device_id, seq, temperature_c, unit, ts, public_key, signature, received_at)
         VALUES
           (@id, @deviceId, @seq, @temperatureC, @unit, @ts, @publicKey, @signature, @receivedAt)`
      )
      .run({
        id: reading.id,
        deviceId: reading.deviceId,
        seq: reading.seq,
        temperatureC: reading.temperatureC,
        unit: reading.unit,
        ts: reading.ts,
        publicKey: reading.publicKey,
        signature: reading.signature,
        receivedAt: reading.receivedAt.toISOString(),
      });
  }

  async list(): Promise<Reading[]> {
    const rows = this.db
      .prepare("SELECT * FROM readings ORDER BY received_at DESC")
      .all() as ReadingRow[];
    return rows.map(toReading);
  }

  async listByDeviceId(deviceId: string): Promise<Reading[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM readings WHERE device_id = ? ORDER BY received_at DESC"
      )
      .all(deviceId) as ReadingRow[];
    return rows.map(toReading);
  }
}
