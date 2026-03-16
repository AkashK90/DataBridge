import fs from "fs";
import path from "path";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "events.db");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createMemoryStore() {
  const events = [];
  return {
    async init() {},
    async add(event) {
      events.push(event);
      return event;
    },
    async list() {
      return [...events];
    }
  };
}

async function createSqliteStore(dbPath) {
  const sqlite3 = await import("sqlite3");
  const { Database } = sqlite3.default || sqlite3;

  ensureDir(dbPath);

  const db = new Database(dbPath);

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  await run(
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      status INTEGER NOT NULL,
      contentType TEXT,
      data TEXT NOT NULL
    )`
  );

  return {
    async init() {},
    async add(event) {
      const data = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
      const result = await run(
        "INSERT INTO events (timestamp, status, contentType, data) VALUES (?, ?, ?, ?)",
        [event.timestamp, event.status, event.contentType || "", data]
      );
      return { ...event, id: result.lastID };
    },
    async list() {
      const rows = await all("SELECT * FROM events ORDER BY id ASC");
      return rows.map((row) => {
        let parsed = row.data;
        try {
          parsed = JSON.parse(row.data);
        } catch {
          parsed = row.data;
        }
        return {
          id: row.id,
          timestamp: row.timestamp,
          status: row.status,
          contentType: row.contentType,
          data: parsed
        };
      });
    }
  };
}

export async function createStorage() {
  const useSqlite = process.env.USE_SQLITE !== "0";
  const dbPath = process.env.DB_PATH || DEFAULT_DB_PATH;

  if (useSqlite) {
    try {
      return await createSqliteStore(dbPath);
    } catch {
      return createMemoryStore();
    }
  }

  return createMemoryStore();
}
