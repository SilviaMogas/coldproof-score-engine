import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Carrier } from "../../domain/carrier/carrier.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";

interface CarrierRow {
  id: string;
  name: string;
  hedera_account_id: string | null;
}

/**
 * SQLite-backed carrier store using better-sqlite3 (synchronous driver).
 * The schema is created on construction, so the file is ready to use immediately.
 */
export class SqliteCarrierRepository
  implements CarrierRepository
{
  private readonly db: Database.Database;

  constructor(filename: string) {
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS carriers (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        hedera_account_id TEXT
      );
    `);
    // Backfill the column for databases created before it existed.
    const hasAccount = (
      this.db.prepare("PRAGMA table_info(carriers)").all() as {
        name: string;
      }[]
    ).some((c) => c.name === "hedera_account_id");
    if (!hasAccount) {
      this.db.exec("ALTER TABLE carriers ADD COLUMN hedera_account_id TEXT");
    }
  }

  async save(carrier: Carrier): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO carriers (id, name, hedera_account_id)
         VALUES (@id, @name, @hederaAccountId)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           hedera_account_id = excluded.hedera_account_id`
      )
      .run({
        id: carrier.id,
        name: carrier.name,
        hederaAccountId: carrier.hederaAccountId,
      });
  }

  async findById(id: string): Promise<Carrier | null> {
    const row = this.db
      .prepare("SELECT * FROM carriers WHERE id = ?")
      .get(id) as CarrierRow | undefined;
    return row ? toCarrier(row) : null;
  }

  async list(): Promise<Carrier[]> {
    const rows = this.db
      .prepare("SELECT * FROM carriers ORDER BY name ASC")
      .all() as CarrierRow[];
    return rows.map(toCarrier);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM carriers WHERE id = ?").run(id);
  }
}

function toCarrier(row: CarrierRow): Carrier {
  return {
    id: row.id,
    name: row.name,
    hederaAccountId: row.hedera_account_id ?? null,
  };
}
