// backend/database.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

let dbPromise;

const initDb = async () => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = open({
    filename: "./db.sqlite",
    driver: sqlite3.Database
  });

  const db = await dbPromise;

  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS galleries (
      id TEXT PRIMARY KEY,
      name TEXT,
      createdAt INTEGER,
      expiresAt INTEGER,
      zipReady INTEGER DEFAULT 0,
      zipError INTEGER DEFAULT 0,
      zipProgress INTEGER DEFAULT 0,
      uploadSuccess INTEGER DEFAULT 0
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      galleryId TEXT,
      filename TEXT,
      originalname TEXT,
      downloads INTEGER DEFAULT 0,
      thumbnail TEXT DEFAULT NULL
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_gallery_id
    ON files (galleryId);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_gallery_originalname
    ON files (galleryId, originalname COLLATE NOCASE);
  `);

  // If older DB without thumbnail column exists, try to add it (safe)
  try {
    const cols = await db.all(`PRAGMA table_info(files)`);
    const hasThumb = cols.some(c => c.name === "thumbnail");
    if (!hasThumb) {
      await db.exec(`ALTER TABLE files ADD COLUMN thumbnail TEXT DEFAULT NULL;`);
      console.log("✅ DB: column 'thumbnail' added to files.");
    }
  } catch (e) {
    // ignore if can't alter (e.g. older sqlite versions) — table was created with thumbnail above.
  }

  const fileColumns = await db.all("PRAGMA table_info(files)");
  if (!fileColumns.some(column => column.name === "preview")) {
    await db.exec("ALTER TABLE files ADD COLUMN preview TEXT DEFAULT NULL");
  }

  if (!fileColumns.some(column => column.name === "sizeBytes")) {
    await db.exec("ALTER TABLE files ADD COLUMN sizeBytes INTEGER DEFAULT 0");
  }
  for (const column of ["uploadedAt", "lastModified"]) {
    if (!fileColumns.some(existing => existing.name === column)) {
      await db.exec(`ALTER TABLE files ADD COLUMN ${column} INTEGER DEFAULT NULL`);
    }
  }
  return db;
};

export default initDb;
