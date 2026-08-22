// routes/tasks.js
// Basic CRUD for task management — this is the foundation the metrics
// (Delivery Reliability, Focus Stability) will read from later.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tasks — list all tasks
router.get('/', (req, res) => {
  const tasks = db.prepare(`
    SELECT tasks.*, developers.name AS assignee_name
    FROM tasks
    LEFT JOIN developers ON developers.id = tasks.assignee_id
    ORDER BY tasks.created_at DESC
  `).all();
  res.json(tasks);
});

// GET /api/tasks/:id — get one task
router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks — create a task
router.post('/', (req, res) => {
  const { title, assignee_id, priority, due_date } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, assignee_id, priority, due_date, status)
    VALUES (?, ?, ?, ?, 'todo')
  `).run(title, assignee_id || null, priority || 'medium', due_date || null);

  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newTask);
});

// PUT /api/tasks/:id — update a task (edit fields or change status)
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const {
    title = existing.title,
    assignee_id = existing.assignee_id,
    status = existing.status,
    priority = existing.priority,
    due_date = existing.due_date,
  } = req.body;

  // Auto-stamp completed_date when a task moves to 'done'
  let completed_date = existing.completed_date;
  if (status === 'done' && existing.status !== 'done') {
    completed_date = new Date().toISOString().slice(0, 10);
  }
  if (status !== 'done') {
    completed_date = null;
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?, assignee_id = ?, status = ?, priority = ?, due_date = ?, completed_date = ?
    WHERE id = ?
  `).run(title, assignee_id, status, priority, due_date, completed_date, req.params.id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/tasks/:id — delete a task
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
