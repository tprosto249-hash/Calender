import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDB() {
    const db = await open({
        filename: "./events.db",
        driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        status TEXT
      );
  `);

    return db;
}
