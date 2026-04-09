INSERT INTO daily_counts (day_date, counter_value)
VALUES
    ('2026-03-29', 2),
    ('2026-03-30', 4),
    ('2026-03-31', 3),
    ('2026-04-01', 7),
    ('2026-04-02', 5),
    ('2026-04-03', 8),
    ('2026-04-04', 6),
    ('2026-04-05', 10),
    ('2026-04-06', 9),
    ('2026-04-07', 12),
    ('2026-04-08', 11),
    ('2026-04-09', 14),
    ('2026-04-10', 16)
ON CONFLICT(day_date) DO UPDATE SET
    counter_value = excluded.counter_value,
    updated_at = CURRENT_TIMESTAMP;
