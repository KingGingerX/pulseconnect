/**
 * PulseConnect marketplace database.
 * Uses bun:sqlite — only imported dynamically so Vite doesn't choke on it.
 *
 * All Node.js-specific imports are inside getDb() so they never
 * execute or get analyzed during client-side bundling.
 */
import type { Database } from "bun:sqlite";

let _db: Database | null = null;
let _dbPath: string | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  if (typeof window !== "undefined") {
    throw new Error("Database is server-only — use from createServerFn handlers");
  }

  const { join } = await import("node:path");
  const { mkdirSync } = await import("node:fs");
  const { Database: Sqlite } = await import("bun:sqlite");

  const dbPath = join(import.meta.dir, "../../data/pulseconnect.db");
  _dbPath = dbPath;

  mkdirSync(join(import.meta.dir, "../../data"), { recursive: true });

  _db = new Sqlite(dbPath, { create: true });
  _db.run("PRAGMA journal_mode=WAL");
  _db.run("PRAGMA foreign_keys=ON");
  migrate(_db);
  return _db;
}

/** Synchronous accessor for handlers that already waited on getDb() once. */
export function db(): Database {
  if (!_db) throw new Error("Call getDb() first");
  return _db;
}

function migrate(database: Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      user_type TEXT NOT NULL CHECK(user_type IN ('creator', 'company')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS creator_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      display_name TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      niche TEXT DEFAULT '',
      social_links TEXT DEFAULT '{}',
      theme TEXT DEFAULT 'default',
      font TEXT DEFAULT 'sans',
      emojis TEXT DEFAULT '[]',
      customization_level TEXT DEFAULT 'free' CHECK(customization_level IN ('free', 'premium')),
      is_tgb_affiliate INTEGER DEFAULT 0,
      tgb_affiliate_code TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      company_name TEXT NOT NULL,
      website TEXT DEFAULT '',
      description TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      tier TEXT DEFAULT 'logo' CHECK(tier IN ('logo', 'access', 'full')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES users(id),
      tier TEXT NOT NULL CHECK(tier IN ('logo', 'access', 'full')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'cancelled', 'expired')),
      start_date TEXT NOT NULL DEFAULT (datetime('now')),
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),
      receiver_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT DEFAULT '',
      body TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL REFERENCES users(id),
      user2_id TEXT NOT NULL REFERENCES users(id),
      last_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES users(id),
      creator_id TEXT NOT NULL REFERENCES users(id),
      terms TEXT DEFAULT '',
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL REFERENCES deals(id),
      company_id TEXT NOT NULL REFERENCES users(id),
      creator_id TEXT NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      platform_fee INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'refunded', 'failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customization_items (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL CHECK(item_type IN ('theme', 'font', 'emoji')),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      preview_url TEXT DEFAULT '',
      available INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_customizations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      item_id TEXT NOT NULL REFERENCES customization_items(id),
      purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS sponsor_logos (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES users(id),
      logo_url TEXT NOT NULL,
      company_name TEXT NOT NULL,
      website_url TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tgb_affiliate_links (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES users(id),
      brand_name TEXT NOT NULL,
      link_url TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      commission_rate REAL DEFAULT 0.1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boosts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      boost_level TEXT NOT NULL CHECK(boost_level IN ('standard', 'premium')),
      starts_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      stripe_payment_id TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Helper to generate UUIDs without external dependencies */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
