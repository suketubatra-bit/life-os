import { createClient, Client } from '@libsql/client'

let _db: Client | null = null
let _ready: Promise<void> | null = null

function getClient(): Client {
  if (!_db) {
    const url = process.env.TURSO_DB_URL
    if (!url) throw new Error('TURSO_DB_URL is not set')
    _db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  }
  return _db
}

async function initSchema(): Promise<void> {
  const db = getClient()
  await db.batch([
    `CREATE TABLE IF NOT EXISTS spheres (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      sphere_id TEXT NOT NULL REFERENCES spheres(id),
      title TEXT NOT NULL,
      description TEXT,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      energizer TEXT CHECK(energizer IN ('play','power','people','adventure','challenge')),
      blocker TEXT CHECK(blocker IN ('fear','uncertainty','inertia','overwhelm')),
      burnout_signal TEXT,
      energy_level TEXT CHECK(energy_level IN ('high','medium','low')),
      ideal_week_slot TEXT,
      calendar_event_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS daily_briefs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('morning','evening')),
      content TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS calendar_tokens (
      id INTEGER PRIMARY KEY DEFAULT 1,
      access_token TEXT,
      refresh_token TEXT,
      expiry_date INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS agent_checkins (
      id TEXT PRIMARY KEY,
      sphere_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      message TEXT NOT NULL,
      questions TEXT NOT NULL DEFAULT '[]',
      suggestions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      depart_date TEXT NOT NULL,
      return_date TEXT,
      target_price INTEGER,
      currency TEXT NOT NULL DEFAULT 'INR',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'watching' CHECK(status IN ('watching','booked','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS price_checks (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      price INTEGER NOT NULL,
      currency TEXT NOT NULL,
      airline TEXT,
      depart_at TEXT,
      link TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    // Seed spheres
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('health','Health','💪','#fecdd3',1)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('career','Career','🚀','#fef08a',2)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('finances','Finances','💰','#bbf7d0',3)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('learning','Learning','📚','#bfdbfe',4)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('creative','Creative','🎨','#e9d5ff',5)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('relationships','Relationships','🫂','#fed7aa',6)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('wellbeing','Wellbeing','🧘','#a7f3d0',7)`,
    `INSERT OR IGNORE INTO spheres (id, name, emoji, color, sort_order) VALUES ('home','Home & Life','🏡','#d9f99d',8)`,
  ], 'write')
}

export async function getDb(): Promise<Client> {
  if (!_ready) _ready = initSchema()
  await _ready
  return getClient()
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

export { nanoid }

export type Sphere = {
  id: string; name: string; emoji: string; color: string; sort_order: number
}

export type Goal = {
  id: string; sphere_id: string; title: string; description: string | null
  deadline: string | null; status: 'active' | 'completed' | 'paused'
  priority: 'low' | 'medium' | 'high'
  energizer: 'play' | 'power' | 'people' | 'adventure' | 'challenge' | null
  blocker: 'fear' | 'uncertainty' | 'inertia' | 'overwhelm' | null
  burnout_signal: string | null; energy_level: 'high' | 'medium' | 'low' | null
  ideal_week_slot: string | null; calendar_event_id: string | null
  created_at: string; updated_at: string
}

export type Task = {
  id: string; goal_id: string; title: string; done: number; sort_order: number; created_at: string
}

export type Trip = {
  id: string; origin: string; destination: string
  depart_date: string; return_date: string | null
  target_price: number | null; currency: string; notes: string | null
  status: 'watching' | 'booked' | 'archived'; created_at: string
}

export type PriceCheck = {
  id: string; trip_id: string; price: number; currency: string
  airline: string | null; depart_at: string | null; link: string | null; checked_at: string
}
