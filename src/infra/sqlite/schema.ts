export const SQLITE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'sky',
  target_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS disciplines (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL DEFAULT 'exam_default',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'sky',
  icon TEXT NOT NULL DEFAULT 'Compass',
  template_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  in_cycle INTEGER NOT NULL DEFAULT 1,
  weight INTEGER NOT NULL DEFAULT 3,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  session_minutes_override INTEGER,
  adjustment REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS trail_levels (
  id TEXT PRIMARY KEY,
  discipline_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  landscape_name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trail_modules (
  id TEXT PRIMARY KEY,
  level_id TEXT NOT NULL,
  discipline_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (level_id) REFERENCES trail_levels(id) ON DELETE CASCADE,
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY,
  discipline_id TEXT NOT NULL,
  level_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  edital_ref TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  checklist_json TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  exercises_done INTEGER NOT NULL DEFAULT 0,
  exercises_correct INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER NOT NULL DEFAULT 2,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_studied_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  difficulties TEXT NOT NULL DEFAULT '',
  history_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  FOREIGN KEY (level_id) REFERENCES trail_levels(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES trail_modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cycle_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_minutes INTEGER NOT NULL,
  session_minutes INTEGER NOT NULL,
  min_block_minutes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cycle_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  plan_json TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  completed_cycles INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_cycle_settings (
  exam_id TEXT PRIMARY KEY,
  cycle_minutes INTEGER NOT NULL,
  session_minutes INTEGER NOT NULL,
  min_block_minutes INTEGER NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_cycle_state (
  exam_id TEXT PRIMARY KEY,
  plan_json TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS active_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  session_json TEXT
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL DEFAULT 'ciclo',
  discipline_id TEXT NOT NULL,
  discipline_name TEXT NOT NULL,
  discipline_theme TEXT NOT NULL,
  content_id TEXT,
  content_title TEXT,
  cycle_number INTEGER NOT NULL,
  block_index INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  planned_minutes INTEGER NOT NULL,
  studied_minutes INTEGER NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS error_records (
  id TEXT PRIMARY KEY,
  discipline_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  description TEXT NOT NULL,
  correction TEXT NOT NULL,
  prevention TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'alta',
  origin TEXT NOT NULL DEFAULT 'desconhecimento',
  reference_question_json TEXT,
  registration_date TEXT NOT NULL,
  overcome_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS error_reviews (
  id TEXT PRIMARY KEY,
  error_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  previous_priority TEXT NOT NULL,
  new_priority TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (error_id) REFERENCES error_records(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  discipline_id TEXT,
  content_id TEXT,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  timestamp TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_disciplines_exam ON disciplines(exam_id);
CREATE INDEX IF NOT EXISTS idx_contents_discipline ON contents(discipline_id);
CREATE INDEX IF NOT EXISTS idx_contents_status ON contents(status);
CREATE INDEX IF NOT EXISTS idx_sessions_discipline ON study_sessions(discipline_id);
CREATE INDEX IF NOT EXISTS idx_sessions_content ON study_sessions(content_id);
CREATE INDEX IF NOT EXISTS idx_sessions_ended ON study_sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_errors_discipline ON error_records(discipline_id);
CREATE INDEX IF NOT EXISTS idx_errors_content ON error_records(content_id);
CREATE INDEX IF NOT EXISTS idx_errors_priority ON error_records(priority);
CREATE INDEX IF NOT EXISTS idx_error_reviews_error ON error_reviews(error_id);
CREATE INDEX IF NOT EXISTS idx_oplogs_timestamp ON operation_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_unsynced ON sync_outbox(synced_at);
`;

