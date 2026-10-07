// app.js
// Vanilla JS — no build step needed. Talks to the same server that serves
// this page, so API_BASE is just relative paths.

const API_BASE = '/api';

// Metrics currently wired up on the backend, plus placeholders for what's
// still to come — keeps the dashboard's final shape visible from day one.
const METRIC_DEFS = [
  { key: 'deliveryReliability',   label: 'Delivery Reliability',    unit: '%', wired: true },
  { key: 'defectPrevention',      label: 'Defect Prevention',       unit: '%', wired: true },
  { key: 'qualityImpact',         label: 'Quality Impact',          unit: '',  wired: true },
  { key: 'technicalDebtExposure', label: 'Technical Debt Exposure', unit: '',  wired: true },
  { key: 'focusStability',        label: 'Focus Stability',         unit: '%', wired: true },
  { key: 'learningGrowth',        label: 'Learning & Growth',       unit: '',  wired: true },
  { key: 'collaborationIndex',    label: 'Collaboration Index',     unit: '',  wired: true },
  { key: 'automationStrength',    label: 'Automation Strength',     unit: '',  wired: true },
  { key: 'burnoutRisk',           label: 'Burnout Risk',            unit: '%', wired: true, inverted: true },
];

// Suggested starter text for the "Send recommendation" prompt — managers
// can edit freely before sending, this is just a helpful default.
const METRIC_TIPS = {
  deliveryReliability: "Let's review your current task load and due dates together — happy to reprioritize if needed.",
  defectPrevention: "Let's build in a bit more testing time before marking tasks done — maybe pair with QA on tricky areas.",
  qualityImpact: "Let's carve out time to add test coverage on recent work and look at what SonarCloud is flagging.",
  technicalDebtExposure: "Let's schedule some time to refactor the flagged files — I can help prioritize which ones matter most.",
  focusStability: "I've noticed you're juggling a few things at once — let's talk about limiting work-in-progress to one task at a time.",
  learningGrowth: "Would a course or certification help this sprint? Happy to suggest a few options if useful.",
  collaborationIndex: "Let's find a PR to review together, or a teammate you could pair with this week.",
  automationStrength: "Let's look at adding a few more automated tests, or dig into any flaky tests together.",
  burnoutRisk: "I've noticed some signs you might be stretched thin — let's talk about redistributing tasks or taking some time to recover.",
};

// --- Sidebar navigation ---
// Switches which panel is visible. All existing element IDs are unchanged
// from before this restructure — only their DOM nesting/visibility changed,
// so every loadAll/renderMetrics/event-listener call below still works
// exactly as it did on the single long-scroll page.

document.querySelectorAll('.sidebar-link').forEach((link) => {
  link.addEventListener('click', () => {
    if (link.id === 'manageUsersLink') {
      window.location.href = 'admin-users.html';
      return;
    }
    document.querySelectorAll('.sidebar-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page-section').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(`section-${link.dataset.section}`);
    if (target) target.classList.add('active');
  });
});

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });

  if (res.status === 401) {
    // Session missing or expired — bounce to login
    window.location.href = 'login.html';
    return null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function checkAuthOrRedirect() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = 'login.html';
    return null;
  }
  const user = await res.json();
  // This page is the manager/admin view. Developers/QA belong on their
  // activity-only page instead.
  if (user.role === 'developer' || user.role === 'qa') {
    window.location.href = 'my-activity.html';
    return null;
  }
  return user;
}

function statusColorFor(score, inverted = false) {
  if (score === null || score === undefined) return null;
  if (inverted) {
    // For burnout-style metrics, HIGH score = bad. Flip the thresholds.
    if (score < 40) return 'good';
    if (score < 70) return 'warn';
    return 'bad';
  }
  if (score >= 80) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

function renderMetrics(summary) {
  const grid = document.getElementById('metricsGrid');
  const strip = document.getElementById('pipelineStrip');
  grid.innerHTML = '';
  strip.innerHTML = '';

  METRIC_DEFS.forEach(def => {
    const data = summary[def.key];
    const score = data ? data.score : null;
    const statusClass = statusColorFor(score, def.inverted);

    // Pipeline strip segment
    const seg = document.createElement('span');
    if (statusClass) seg.className = statusClass;
    strip.appendChild(seg);

    // Metric card
    const card = document.createElement('div');
    card.className = 'metric-card' + (def.wired ? '' : ' placeholder');
    if (statusClass) {
      const colorVar = statusClass === 'good' ? 'var(--accent-good)'
          : statusClass === 'warn' ? 'var(--accent-warn)'
              : 'var(--accent-bad)';
      card.style.setProperty('--status-color', colorVar);
    }

    const valueDisplay = score === null || score === undefined
        ? '—'
        : `${score}<span class="unit">${def.unit}</span>`;

    const subText = !def.wired
        ? 'Not built yet'
        : (data && data.total !== undefined ? `${data.onTime}/${data.total} on time` : (data && data.message) || '');

    card.innerHTML = `
      <p class="metric-label">${def.label}</p>
      <div class="metric-value">${valueDisplay}</div>
      <p class="metric-sub">${subText}</p>
      ${statusClass ? `<span class="metric-status">${statusClass === 'good' ? 'on track' : statusClass === 'warn' ? 'monitor' : 'at risk'}</span>` : ''}
      ${dateFilter.developer_id ? `<button class="rec-btn" data-metric="${def.key}" data-label="${def.label}">💡 Recommend</button>` : ''}
    `;
    grid.appendChild(card);
  });
}

function formatDate(d) {
  if (!d) return null;
  return d;
}

// Returns the action buttons for a task row, based on its current status.
// todo -> in_progress -> done, with the ability to step back at each stage.
function taskActionsFor(task) {
  const buttons = [];

  if (task.status === 'todo') {
    buttons.push(`<button data-action="start" data-id="${task.id}">Start</button>`);
  } else if (task.status === 'in_progress') {
    buttons.push(`<button data-action="done" data-id="${task.id}">Mark done</button>`);
    buttons.push(`<button data-action="pause" data-id="${task.id}">Back to to-do</button>`);
  } else if (task.status === 'done') {
    buttons.push(`<button data-action="reopen" data-id="${task.id}">Reopen</button>`);
  }

  buttons.push(`<button data-action="delete" data-id="${task.id}" class="danger">Delete</button>`);
  return buttons.join('');
}

function renderTasks(tasks) {
  const list = document.getElementById('taskList');
  document.getElementById('taskCount').textContent = tasks.length;

  if (tasks.length === 0) {
    list.innerHTML = '<p class="empty-state">No tasks yet — add one above to get started.</p>';
    return;
  }

  list.innerHTML = tasks.map(task => `
    <div class="task-row" data-id="${task.id}">
      <span class="task-status-dot ${task.status}"></span>
      <span class="task-title ${task.status === 'done' ? 'done' : ''}">${escapeHtml(task.title)}</span>
      <span class="task-meta">
        <span class="task-priority ${task.priority}">${task.priority}</span>
        ${task.status === 'in_progress' ? '<span class="task-inprogress-tag">in progress</span>' : ''}
        ${task.due_date ? `<span>due ${formatDate(task.due_date)}</span>` : ''}
        ${task.assignee_name ? `<span>${escapeHtml(task.assignee_name)}</span>` : ''}
      </span>
      <span class="task-actions">
        ${taskActionsFor(task)}
      </span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Developers ---
// Populates the three assignee dropdowns (task form, growth log, collab
// log) once on load. Developers list rarely changes mid-session, so this
// doesn't need to be part of the 15s polling loop.

async function loadDevelopers() {
  try {
    const developers = await fetchJSON(`${API_BASE}/developers`);
    if (!developers) return;

    const taskSelect = document.getElementById('taskAssignee');
    const growthSelect = document.getElementById('growthAssignee');
    const collabSelect = document.getElementById('collabAssignee');
    const checkinSelect = document.getElementById('checkinAssignee');
    const filterSelect = document.getElementById('filterDeveloper');

    const options = developers.map((d) =>
        `<option value="${d.id}">${escapeHtml(d.name)}</option>`
    ).join('');

    taskSelect.innerHTML = '<option value="">Unassigned</option>' + options;
    growthSelect.innerHTML = '<option value="">Select your name…</option>' + options;
    collabSelect.innerHTML = '<option value="">Select your name…</option>' + options;
    checkinSelect.innerHTML = '<option value="">Select your name…</option>' + options;
    filterSelect.innerHTML = '<option value="">All developers</option>' + options;
  } catch (err) {
    console.error('Could not load developers list:', err);
  }
}

let dateFilter = { from: '', to: '', developer_id: '' };

function buildSummaryUrl() {
  const params = new URLSearchParams();
  if (dateFilter.from) params.set('from', dateFilter.from);
  if (dateFilter.to) params.set('to', dateFilter.to);
  if (dateFilter.developer_id) params.set('developer_id', dateFilter.developer_id);
  const qs = params.toString();
  return `${API_BASE}/metrics/summary${qs ? '?' + qs : ''}`;
}

async function loadAll() {
  try {
    const [summary, tasks] = await Promise.all([
      fetchJSON(buildSummaryUrl()),
      fetchJSON(`${API_BASE}/tasks`),
    ]);
    renderMetrics(summary);
    renderTasks(tasks);
    document.getElementById('lastUpdated').textContent =
        'updated ' + new Date().toLocaleTimeString();

    const growthScore = summary.learningGrowth && summary.learningGrowth.score;
    document.getElementById('growthScoreLabel').textContent =
        growthScore === null || growthScore === undefined ? '—' : `${growthScore}%`;

    const collabScore = summary.collaborationIndex && summary.collaborationIndex.score;
    document.getElementById('collabScoreLabel').textContent =
        collabScore === null || collabScore === undefined ? '—' : `${collabScore}%`;
  } catch (err) {
    document.getElementById('lastUpdated').textContent = 'connection error';
    console.error(err);
  }
}

// --- Event handlers ---

document.getElementById('metricsGrid').addEventListener('click', async (e) => {
  const btn = e.target.closest('.rec-btn');
  if (!btn) return;

  if (!dateFilter.developer_id) {
    alert('Select a specific developer in the filter above first.');
    return;
  }

  const metricKey = btn.dataset.metric;
  const label = btn.dataset.label;
  const suggested = METRIC_TIPS[metricKey] || '';
  const message = window.prompt(`Send a recommendation for ${label}:`, suggested);
  if (!message || !message.trim()) return;

  try {
    await fetchJSON(`${API_BASE}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        developer_id: dateFilter.developer_id,
        metric_key: metricKey,
        message: message.trim(),
      }),
    });
    alert('Recommendation sent.');
  } catch (err) {
    alert(err.message || 'Could not send recommendation');
  }
});

document.getElementById('dateFilterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  dateFilter.from = document.getElementById('filterFrom').value;
  dateFilter.to = document.getElementById('filterTo').value;
  dateFilter.developer_id = document.getElementById('filterDeveloper').value;
  loadAll();
});

document.getElementById('clearFilterBtn').addEventListener('click', () => {
  dateFilter = { from: '', to: '', developer_id: '' };
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  document.getElementById('filterDeveloper').value = '';
  loadAll();
});

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  const assignee_id = document.getElementById('taskAssignee').value || null;
  const priority = document.getElementById('taskPriority').value;
  const due_date = document.getElementById('taskDueDate').value || null;

  if (!title) return;

  await fetchJSON(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, assignee_id, priority, due_date }),
  });

  e.target.reset();
  document.getElementById('taskPriority').value = 'medium';
  loadAll();
});

document.getElementById('taskList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  } else if (action === 'start') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
  } else if (action === 'done') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
  } else if (action === 'pause') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'todo' }),
    });
  } else if (action === 'reopen') {
    await fetchJSON(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
  }

  loadAll();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = 'login.html';
});

// --- Defect Radar ---
// JIRA-style: title, description, severity, then the same two outcome
// buttons as before — matching the Developer/QA "My Activity" page so the
// panel looks and behaves the same regardless of which dashboard it's on.

function bugSeverityIcon(severity) {
  if (severity === 'high') return '🔴';
  if (severity === 'low') return '🟢';
  return '🟡';
}

async function refreshBugRecent() {
  const list = document.getElementById('bugRecentList');
  try {
    const bugs = await fetchJSON(`${API_BASE}/bugs`);
    if (!bugs || bugs.length === 0) {
      list.innerHTML = '<p class="empty-state">No bugs logged yet.</p>';
      return;
    }
    list.innerHTML = bugs.slice(0, 5).map((b) => `
      <div class="growth-recent-item">
        <span>${bugSeverityIcon(b.severity)}</span>
        <span class="growth-recent-item-title">${escapeHtml(b.title)} ${b.status === 'resolved' ? '(resolved)' : ''}</span>
        <span class="growth-recent-item-time">${b.reported_by_name ? escapeHtml(b.reported_by_name) : ''}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('bugForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const outcome = e.submitter ? e.submitter.dataset.outcome : null;
  const title = document.getElementById('bugTitle').value.trim();
  const description = document.getElementById('bugDescription').value.trim();
  const severity = document.getElementById('bugSeverity').value;
  const feedback = document.getElementById('radarFeedback');

  if (!outcome || !title) {
    feedback.textContent = 'enter a bug title first';
    return;
  }

  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        severity,
        found_in_testing: outcome === 'caught' ? 1 : 0,
      }),
    });
    feedback.textContent = outcome === 'caught' ? 'logged — caught before release' : 'logged — escaped to prod';
    document.getElementById('bugTitle').value = '';
    document.getElementById('bugDescription').value = '';
    document.getElementById('bugSeverity').value = 'medium';
    refreshBugRecent();
  } catch (err) {
    feedback.textContent = err.message || 'could not log — try again';
  }
  await refreshDefectRadar();
  loadAll();
});

async function refreshDefectRadar() {
  const fill = document.getElementById('radarBarFill');
  const label = document.getElementById('radarBarLabel');
  try {
    const data = await fetchJSON(`${API_BASE}/metrics/defect-prevention`);
    if (!data || data.score === null || data.score === undefined) {
      fill.style.width = '0%';
      label.textContent = '—';
      return;
    }
    fill.style.width = `${data.score}%`;
    label.textContent = `${data.score}%`;
  } catch (err) {
    label.textContent = '—';
    console.error(err);
  }
}

// --- Growth Log ---
// Same one-tap-logging spirit as Defect Radar: type what you finished,
// tap the category, done. No multi-field form to slow people down.

function achievementIcon(type) {
  if (type === 'course') return '📘';
  if (type === 'certification') return '🎓';
  return '🛠';
}

function timeAgo(isoString) {
  const then = new Date(isoString.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function refreshGrowthRecent() {
  const list = document.getElementById('growthRecentList');
  try {
    const achievements = await fetchJSON(`${API_BASE}/achievements`);
    if (!achievements || achievements.length === 0) {
      list.innerHTML = '<p class="empty-state">No achievements logged yet.</p>';
      return;
    }
    list.innerHTML = achievements.slice(0, 3).map((a) => `
      <div class="growth-recent-item">
        <span>${achievementIcon(a.type)}</span>
        <span class="growth-recent-item-title">${escapeHtml(a.title || a.type)}</span>
        <span class="growth-recent-item-time">${timeAgo(a.created_at)}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('growthForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitter = e.submitter; // the specific button that was clicked
  const type = submitter ? submitter.dataset.type : null;
  const developer_id = document.getElementById('growthAssignee').value;
  const title = document.getElementById('growthTitle').value.trim();
  const feedback = document.getElementById('growthFeedback');

  if (!type || !developer_id || !title) {
    feedback.textContent = 'enter your developer ID and a title first';
    return;
  }

  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/achievements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id, type, title }),
    });
    feedback.textContent = `logged — ${type}`;
    document.getElementById('growthTitle').value = '';
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }

  await refreshGrowthRecent();
  loadAll();
});

// --- Collaboration Log ---
// Same one-tap pattern as Defect Radar: select your name once, then tap
// whichever type of collaboration just happened. No title needed here.
async function logCollaboration(type) {
  const developer_id = document.getElementById('collabAssignee').value;
  const feedback = document.getElementById('collabFeedback');
  if (!developer_id) {
    feedback.textContent = 'select your name first';
    return;
  }
  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/collaborations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id, type }),
    });
    feedback.textContent = `logged — ${type}`;
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }
  loadAll();
}
document.querySelectorAll('.collab-btn').forEach((btn) => {
  btn.addEventListener('click', () => logCollaboration(btn.dataset.type));
});

// --- Wellbeing Check-in ---
// Private, supportive, one-tap. This exists to protect people, not to
// rank or punish them — keep the copy and framing consistent with that.

async function logCheckin(loadRating) {
  const developer_id = document.getElementById('checkinAssignee').value;
  const feedback = document.getElementById('checkinFeedback');

  if (!developer_id) {
    feedback.textContent = 'select your name first';
    return;
  }

  feedback.textContent = 'logging…';
  try {
    await fetchJSON(`${API_BASE}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id, load_rating: loadRating }),
    });
    feedback.textContent = 'thanks for checking in';
  } catch (err) {
    feedback.textContent = 'could not log — try again';
    console.error(err);
  }
  loadAll();
}

document.querySelectorAll('.checkin-btn').forEach((btn) => {
  btn.addEventListener('click', () => logCheckin(Number(btn.dataset.rating)));
});

// Require a logged-in session before showing any data
(async () => {
  const user = await checkAuthOrRedirect();
  if (!user) return; // already redirecting to login.html
  document.getElementById('currentUser').textContent = user.username;
  if (user.role === 'admin') {
    document.getElementById('manageUsersLink').style.display = 'flex';
  }
  loadDevelopers();
  loadAll();
  refreshDefectRadar();
  refreshGrowthRecent();
  setInterval(loadAll, 15000);
  setInterval(refreshDefectRadar, 15000);
  setInterval(refreshGrowthRecent, 15000);
})();