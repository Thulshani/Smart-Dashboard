// db.js
// Sets up a local SQLite database file and creates the core tables.


const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dashboard.db'));

db.pragma('journal_mode = WAL');

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'member', -- 'member' | 'admin'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS developers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'developer' -- 'developer' | 'qa' | 'lead'
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    assignee_id INTEGER,
    status TEXT NOT NULL DEFAULT 'todo', -- 'todo' | 'in_progress' | 'done'
    priority TEXT DEFAULT 'medium',      -- 'low' | 'medium' | 'high'
    due_date TEXT,                       -- ISO date string, e.g. '2026-08-10'
    completed_date TEXT,                 -- set when status becomes 'done'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignee_id) REFERENCES developers(id)
  );
`);

// Bugs table included now because Delivery Reliability's sibling metric
// (Defect Prevention Ratio) will need it in the next step — schema is ready.
db.exec(`
  CREATE TABLE IF NOT EXISTS bugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    found_in_testing INTEGER NOT NULL DEFAULT 0, -- 1 = caught before release, 0 = escaped to prod
    severity TEXT DEFAULT 'medium',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );
`);

// Achievements table for the Learning & Growth Score — self-logged courses,
// certifications, and new tools adopted by each developer.
db.exec(`
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'course' | 'certification' | 'tool'
    title TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );
`);

// Collaborations table for the Collaboration Index — self-logged PR
// reviews, teammates helped, and shared tasks per developer.
db.exec(`
  CREATE TABLE IF NOT EXISTS collaborations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'review' | 'help' | 'shared'
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );
`);

module.exports = db;