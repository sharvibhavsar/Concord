-- ==========================================
-- Concord SQL Query Repository (SQLite)
-- Grouped Queries for Developers & Analytics
-- ==========================================

-- ==========================================
-- SECTION 1: USER QUERIES
-- ==========================================

-- 1.1 View all users
SELECT id, email, first_name, last_name, country, timezone, created_at 
FROM users;

-- 1.2 Total registered users count
SELECT COUNT(*) AS total_users 
FROM users;

-- 1.3 View all user profiles including cycle preferences
SELECT user_id, display_name, gender, last_period_date, cycle_length, luteal_phase_length, theme_preference, analytics_theme, weekend_available, productive_time_start, productive_time_end 
FROM user_profiles;

-- 1.4 Active users (users who have created at least one task)
SELECT u.id, u.email, COUNT(t.id) AS task_count
FROM users u
JOIN tasks t ON u.id = t.user_id
GROUP BY u.id;


-- ==========================================
-- SECTION 2: TASK QUERIES
-- ==========================================

-- 2.1 View all tasks
SELECT id, user_id, title, category, priority, status, deadline, scheduled_date, duration, created_at 
FROM tasks;

-- 2.2 View all pending tasks
SELECT id, title, category, priority, status, deadline, scheduled_date
FROM tasks 
WHERE status != 'completed'
ORDER BY priority DESC, deadline ASC;

-- 2.3 View all completed tasks
SELECT id, title, category, priority, status, deadline, duration
FROM tasks 
WHERE status = 'completed'
ORDER BY updated_at DESC;

-- 2.4 View all high-priority tasks
SELECT id, title, category, status, deadline 
FROM tasks 
WHERE priority = 'high';

-- 2.5 View tasks by category
SELECT category, COUNT(*) AS task_count, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
FROM tasks 
GROUP BY category;

-- 2.6 View tasks by scheduled date
SELECT scheduled_date, COUNT(*) AS tasks_scheduled 
FROM tasks 
WHERE scheduled_date IS NOT NULL
GROUP BY scheduled_date
ORDER BY scheduled_date DESC;

-- 2.7 View overdue tasks (pending tasks with deadlines in the past)
SELECT id, title, priority, status, deadline 
FROM tasks 
WHERE status != 'completed' 
  AND deadline IS NOT NULL 
  AND datetime(deadline) < datetime('now')
ORDER BY deadline ASC;


-- ==========================================
-- SECTION 3: CALENDAR & WORKLOAD QUERIES
-- ==========================================

-- 3.1 Daily task workload distribution
SELECT scheduled_date, COUNT(*) AS daily_task_count
FROM tasks 
WHERE scheduled_date IS NOT NULL
GROUP BY scheduled_date
ORDER BY daily_task_count DESC;

-- 3.2 Weekly task workload distribution
SELECT strftime('%Y-W%W', COALESCE(scheduled_date, date(created_at))) AS week_id, COUNT(*) AS weekly_tasks
FROM tasks
GROUP BY week_id
ORDER BY week_id DESC;

-- 3.3 Monthly task workload distribution
SELECT strftime('%Y-%m', COALESCE(scheduled_date, date(created_at))) AS month_id, COUNT(*) AS monthly_tasks
FROM tasks
GROUP BY month_id
ORDER BY month_id DESC;

-- 3.4 Peak scheduling days (days with most tasks scheduled)
SELECT COALESCE(scheduled_date, date(created_at)) AS day_date, COUNT(*) AS task_count
FROM tasks
GROUP BY day_date
ORDER BY task_count DESC
LIMIT 5;

-- 3.5 Most productive weekday (completed tasks grouped by day of the week)
-- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
SELECT 
  CASE strftime('%w', updated_at) 
    WHEN '0' THEN 'Sunday'
    WHEN '1' THEN 'Monday'
    WHEN '2' THEN 'Tuesday'
    WHEN '3' THEN 'Wednesday'
    WHEN '4' THEN 'Thursday'
    WHEN '5' THEN 'Friday'
    WHEN '6' THEN 'Saturday'
  END AS day_of_week,
  COUNT(*) AS completed_tasks_count
FROM tasks 
WHERE status = 'completed'
GROUP BY strftime('%w', updated_at)
ORDER BY completed_tasks_count DESC;


-- ==========================================
-- SECTION 4: PRODUCTIVITY QUERIES
-- ==========================================

-- 4.1 Overall completion percentage
SELECT 
  COUNT(*) AS total_tasks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
  ROUND(CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) AS completion_percentage
FROM tasks;

-- 4.2 Completion rate grouped by Priority
SELECT 
  priority,
  COUNT(*) AS total_tasks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
  ROUND(CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) AS completion_rate
FROM tasks
GROUP BY priority;

-- 4.3 Completion rate grouped by Category
SELECT 
  category,
  COUNT(*) AS total_tasks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
  ROUND(CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) AS completion_rate
FROM tasks
GROUP BY category;

-- 4.4 Average task duration (minutes) for completed tasks
SELECT 
  AVG(CAST(duration AS INTEGER)) AS avg_completed_duration_mins 
FROM tasks 
WHERE status = 'completed' AND duration IS NOT NULL;

-- 4.5 User consistency score
-- (Proportion of days in the last 30 days that the user completed at least one task)
WITH DayActivity AS (
  SELECT date(updated_at) AS active_day, COUNT(*) AS completed_count
  FROM tasks
  WHERE status = 'completed'
    AND updated_at >= date('now', '-30 days')
  GROUP BY active_day
)
SELECT 
  COUNT(active_day) AS active_days_last_30,
  ROUND((CAST(COUNT(active_day) AS REAL) / 30.0) * 100, 2) AS consistency_score_percentage
FROM DayActivity;


-- ==========================================
-- SECTION 5: MOOD & WELLNESS QUERIES
-- ==========================================

-- 5.1 Mood frequency distribution
SELECT label, COUNT(*) AS mood_count, AVG(happy) AS avg_happy, AVG(stress) AS avg_stress, AVG(fatigue) AS avg_fatigue
FROM mood_history
GROUP BY label
ORDER BY mood_count DESC;

-- 5.2 Completed Rest tasks count (case-insensitive check for "rest" in title during cycle-aware wellness tracking)
SELECT COUNT(*) AS total_rest_tasks_completed
FROM tasks
WHERE status = 'completed' 
  AND (title LIKE '%rest%' OR raw_input LIKE '%rest%' OR category = 'Wellness');

-- 5.3 Mood vs Productivity (average completed tasks count on days with different mood labels)
SELECT 
  m.label AS mood,
  COUNT(DISTINCT date(m.created_at)) AS logged_days,
  COUNT(t.id) AS completed_tasks_count,
  ROUND(CAST(COUNT(t.id) AS REAL) / COUNT(DISTINCT date(m.created_at)), 2) AS avg_tasks_per_day
FROM mood_history m
LEFT JOIN tasks t ON date(m.created_at) = date(t.updated_at) AND t.status = 'completed'
GROUP BY m.label
ORDER BY avg_tasks_per_day DESC;


-- ==========================================
-- SECTION 6: ANALYTICS SUMMARIES
-- ==========================================

-- 6.1 Average daily task creation rate
SELECT 
  ROUND(CAST(COUNT(*) AS REAL) / COUNT(DISTINCT date(created_at)), 2) AS avg_tasks_created_per_day
FROM tasks;

-- 6.2 Monthly productivity timeline summary
SELECT 
  strftime('%Y-%m', updated_at) AS month_period,
  COUNT(*) AS total_tasks_completed,
  AVG(CAST(duration AS INTEGER)) AS avg_task_duration_mins
FROM tasks
WHERE status = 'completed'
GROUP BY month_period
ORDER BY month_period DESC;
