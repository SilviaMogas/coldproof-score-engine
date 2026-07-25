import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type {
  Delivery,
  DeliveryStatus,
  SettlementResult,
  SettlementStatus,
} from "../../domain/delivery/delivery.js";
import type { DeliveryRepository } from "../../domain/delivery/delivery-repository.js";

interface DeliveryRow {
  id: string;
  from_location: string;
  to_location: string;
  box_contents: string;
  device_id: string;
  carrier_id: string;
  status: string;
  amount_hbar: number;
  settlement_status: string;
  settlement: string | null;
  created_at: string;
}

function toDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    from: row.from_location,
    to: row.to_location,
    boxContents: row.box_contents,
    deviceId: row.device_id,
    carrierId: row.carrier_id,
    status: row.status as DeliveryStatus,
    amountHbar: row.amount_hbar,
    settlementStatus: row.settlement_status as SettlementStatus,
    settlement: row.settlement
      ? (JSON.parse(row.settlement) as SettlementResult)
      : null,
    createdAt: new Date(row.created_at),
  };
}

/**
 * SQLite-backed delivery store using better-sqlite3 (synchronous driver). The
 * schema is created on construction, so the file is ready to use immediately.
 */
export class SqliteDeliveryRepository implements DeliveryRepository {
  private readonly db: Database.Database;

  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id                TEXT PRIMARY KEY,
        from_location     TEXT NOT NULL,
        to_location       TEXT NOT NULL,
        box_contents      TEXT NOT NULL,
        device_id         TEXT NOT NULL,
        carrier_id        TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'ready',
        amount_hbar       REAL NOT NULL DEFAULT 0,
        settlement_status TEXT NOT NULL DEFAULT 'disabled',
        settlement        TEXT,
        created_at        TEXT NOT NULL
      );
    `);
    this.addColumnIfMissing("status", "TEXT NOT NULL DEFAULT 'ready'");
    this.addColumnIfMissing("amount_hbar", "REAL NOT NULL DEFAULT 0");
    this.addColumnIfMissing(
      "settlement_status",
      "TEXT NOT NULL DEFAULT 'disabled'"
    );
    this.addColumnIfMissing("settlement", "TEXT");
  }

  /** Backfills a column for databases created before it existed. */
  private addColumnIfMissing(name: string, definition: string): void {
    const exists = (
      this.db.prepare("PRAGMA table_info(deliveries)").all() as {
        name: string;
      }[]
    ).some((c) => c.name === name);
    if (!exists) {
      this.db.exec(`ALTER TABLE deliveries ADD COLUMN ${name} ${definition}`);
    }
  }

  async save(delivery: Delivery): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO deliveries
           (id, from_location, to_location, box_contents, device_id, carrier_id,
            status, amount_hbar, settlement_status, settlement, created_at)
         VALUES
           (@id, @from, @to, @boxContents, @deviceId, @carrierId,
            @status, @amountHbar, @settlementStatus, @settlement, @createdAt)
         ON CONFLICT(id) DO UPDATE SET
           from_location     = excluded.from_location,
           to_location       = excluded.to_location,
           box_contents      = excluded.box_contents,
           device_id         = excluded.device_id,
           carrier_id        = excluded.carrier_id,
           status            = excluded.status,
           amount_hbar       = excluded.amount_hbar,
           settlement_status = excluded.settlement_status,
           settlement        = excluded.settlement`
      )
      .run({
        id: delivery.id,
        from: delivery.from,
        to: delivery.to,
        boxContents: delivery.boxContents,
        deviceId: delivery.deviceId,
        carrierId: delivery.carrierId,
        status: delivery.status,
        amountHbar: delivery.amountHbar,
        settlementStatus: delivery.settlementStatus,
        settlement: delivery.settlement
          ? JSON.stringify(delivery.settlement)
          : null,
        createdAt: delivery.createdAt.toISOString(),
      });
  }

  async findById(id: string): Promise<Delivery | null> {
    const row = this.db
      .prepare("SELECT * FROM deliveries WHERE id = ?")
      .get(id) as DeliveryRow | undefined;
    return row ? toDelivery(row) : null;
  }

  async findByDeviceId(deviceId: string): Promise<Delivery | null> {
    const row = this.db
      .prepare("SELECT * FROM deliveries WHERE device_id = ?")
      .get(deviceId) as DeliveryRow | undefined;
    return row ? toDelivery(row) : null;
  }

  async list(): Promise<Delivery[]> {
    const rows = this.db
      .prepare("SELECT * FROM deliveries ORDER BY created_at DESC")
      .all() as DeliveryRow[];
    return rows.map(toDelivery);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
  }
}
