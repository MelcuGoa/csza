CREATE TABLE IF NOT EXISTS daily_counts (
    day_date TEXT PRIMARY KEY,
    counter_value INTEGER NOT NULL CHECK (counter_value >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
