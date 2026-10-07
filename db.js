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
    role TEXT DEFAULT 'developer', -- 'admin' | 'manager' | 'developer' | 'qa'
    developer_id INTEGER,          -- links a login to a developers-table row
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for databases created before developer_id existed — safe to
// run every startup, throws (and is ignored) once the column is present.
try {
    db.exec(`ALTER TABLE users ADD COLUMN developer_id INTEGER REFERENCES developers(id)`);
} catch (e) {
    // column already exists — fine
}

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

// Migrations for JIRA-style bug fields added after the table already
// existed — each ADD COLUMN is wrapped separately since SQLite only
// allows one column per ALTER TABLE statement, and throws (safely
// ignored) once a column is already present.
try { db.exec(`ALTER TABLE bugs ADD COLUMN title TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE bugs ADD COLUMN description TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE bugs ADD COLUMN reported_by INTEGER REFERENCES developers(id)`); } catch (e) {}
try { db.exec(`ALTER TABLE bugs ADD COLUMN status TEXT DEFAULT 'open'`); } catch (e) {}

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

db.exec(`
  CREATE TABLE IF NOT EXISTS wellbeing_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id INTEGER NOT NULL,
    load_rating INTEGER NOT NULL, -- 1 (fine) to 5 (overwhelmed)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,   -- 'YYYY-MM-DD'
    start_time TEXT NOT NULL,  -- full ISO datetime
    end_time TEXT,             -- NULL while still clocked in
    hours_worked REAL,         -- set on clock-out
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    developer_id INTEGER NOT NULL,
    manager_id INTEGER NOT NULL,
    metric_key TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id),
    FOREIGN KEY (manager_id) REFERENCES users(id)
  );
`);


try { db.exec(`ALTER TABLE developers ADD COLUMN employee_id TEXT`); } catch (e) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_developers_employee_id ON developers(employee_id) WHERE employee_id IS NOT NULL`); } catch (e) {}

module.exports = db;