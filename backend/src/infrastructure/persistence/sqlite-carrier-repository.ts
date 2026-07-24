import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Carrier } from "../../domain/carrier/carrier.js";
import type { CarrierRepository } from "../../domain/carrier/carrier-repository.js";

interface CarrierRow {
  id: string;
  name: string;
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
        id   TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
  }

  async save(carrier: Carrier): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO carriers (id, name)
         VALUES (@id, @name)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`
      )
      .run({ id: carrier.id, name: carrier.name });
  }

  async findById(id: string): Promise<Carrier | null> {
    const row = this.db
      .prepare("SELECT * FROM carriers WHERE id = ?")
      .get(id) as CarrierRow | undefined;
    return row ? { id: row.id, name: row.name } : null;
  }

  async list(): Promise<Carrier[]> {
    const rows = this.db
      .prepare("SELECT * FROM carriers ORDER BY name ASC")
      .all() as CarrierRow[];
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM carriers WHERE id = ?").run(id);
  }
}
