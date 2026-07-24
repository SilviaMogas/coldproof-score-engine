import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Device, DeviceStatus } from "../../domain/device/device.js";
import type { DeviceRepository } from "../../domain/device/device-repository.js";

interface DeviceRow {
  id: string;
  device_id: string;
  public_key: string;
  label: string;
  status: string;
  created_at: string;
}

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    deviceId: row.device_id,
    publicKey: row.public_key,
    label: row.label,
    status: row.status as DeviceStatus,
    createdAt: new Date(row.created_at),
  };
}

/**
 * SQLite-backed device store using better-sqlite3 (synchronous driver). The
 * schema is created on construction, so the file is ready to use immediately.
 */
export class SqliteDeviceRepository implements DeviceRepository {
  private readonly db: Database.Database;

  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id         TEXT PRIMARY KEY,
        device_id  TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        label      TEXT NOT NULL,
        status     TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async save(device: Device): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO devices (id, device_id, public_key, label, status, created_at)
         VALUES (@id, @deviceId, @publicKey, @label, @status, @createdAt)
         ON CONFLICT(device_id) DO UPDATE SET
           public_key = excluded.public_key,
           label      = excluded.label,
           status     = excluded.status`
      )
      .run({
        id: device.id,
        deviceId: device.deviceId,
        publicKey: device.publicKey,
        label: device.label,
        status: device.status,
        createdAt: device.createdAt.toISOString(),
      });
  }

  async findByDeviceId(deviceId: string): Promise<Device | null> {
    const row = this.db
      .prepare("SELECT * FROM devices WHERE device_id = ?")
      .get(deviceId) as DeviceRow | undefined;
    return row ? toDevice(row) : null;
  }

  async list(): Promise<Device[]> {
    const rows = this.db
      .prepare("SELECT * FROM devices ORDER BY created_at DESC")
      .all() as DeviceRow[];
    return rows.map(toDevice);
  }

  async delete(deviceId: string): Promise<void> {
    this.db.prepare("DELETE FROM devices WHERE device_id = ?").run(deviceId);
  }
}
