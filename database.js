// database.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDB() {
    const db = await open({
        filename: "./events.db",
        driver: sqlite3.Database
    });

    // Таблиця подій з полями для нагадувань, категорій та статусів
    await db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,        -- YYYY-MM-DD
      time TEXT,                 -- HH:MM (24h)
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT DEFAULT 'scheduled', -- scheduled / completed / overdue
      reminder_type TEXT DEFAULT 'none', -- email / push / none
      notify_before INTEGER DEFAULT 0,   -- minutes before event to notify
      email TEXT,
      notified INTEGER DEFAULT 0, -- 0/1 - чи вже відправлялось нагадування
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

    // Простий лог відправок
    await db.exec(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      success INTEGER,
      info TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

    return db;
}
