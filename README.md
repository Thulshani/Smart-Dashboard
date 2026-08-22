# Smart Developer & QA Performance Analytics Dashboard — Backend Starter

## What's in this starter
- **User authentication**: register/login/logout with sessions (`/api/auth/*`) — the dashboard is locked behind a login page (`login.html`)
- Task management: full CRUD (`/api/tasks`) — requires login
- Developers list (`/api/developers`) — requires login
- First metric wired end-to-end: **Delivery Reliability Score** (`/api/metrics/delivery-reliability`) — requires login
- SQLite database (zero setup — a `dashboard.db` file is created automatically)

## First-time login
There's no pre-made account — go to `http://localhost:3001/login.html`, click **"Create account"**, and sign up with any username/password (min 6 characters). You'll be redirected straight into the dashboard and logged in automatically going forward until you log out or the session expires (8 hours).

**Note:** the session secret in `server.js` (`'dev-only-secret-change-this-before-real-deployment'`) is a placeholder for local development only — replace it with a long random string (and load it from an environment variable) before deploying this anywhere real.

## Setup

```bash
npm install
npm start
```

Server runs at `http://localhost:3001`

## Try it out

```bash
# Add a developer
curl -X POST http://localhost:3001/api/developers -H "Content-Type: application/json" \
  -d '{"name": "Asha Perera", "role": "developer"}'

# Add a task
curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" \
  -d '{"title": "Fix login bug", "assignee_id": 1, "due_date": "2026-08-10"}'

# Mark it done
curl -X PUT http://localhost:3001/api/tasks/1 -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# See the metric
curl http://localhost:3001/api/metrics/delivery-reliability
```

## Next steps (in build order)
1. Add a `bugs` table endpoint + Defect Prevention Ratio metric (schema already exists in `db.js`)
2. Build a simple React frontend that calls `/api/metrics/summary` and `/api/tasks`
3. Add remaining metrics one at a time in `metrics/` folder, following the same pattern as `deliveryReliability.js`
4. Swap `better-sqlite3` for a Postgres client when you're ready for production — routes and metric functions don't need to change
