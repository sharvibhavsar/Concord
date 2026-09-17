import os
import json
import sqlite3
from datetime import datetime

def generate_sqlite():
    print("--------------------------------------------------")
    print("Concord Local Storage to SQLite Database Generator")
    print("--------------------------------------------------")

    json_path = "localStorageExport.json"
    db_path = "concord.db"

    if not os.path.exists(json_path):
        print(f"Error: Could not find '{json_path}' in the root directory.")
        print("Please export your localStorage from the browser console using copy(JSON.stringify(localStorage))")
        print("and save it as 'localStorageExport.json' in the project root directory, then run this generator again.")
        return

    print(f"Loading LocalStorage data from '{json_path}'...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            storage = json.load(f)
    except Exception as e:
        print(f"Error reading JSON export: {e}")
        return

    print(f"Connecting to SQLite database '{db_path}'...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop existing tables to ensure a clean snapshot refresh
    print("Refreshing database tables...")
    cursor.execute("DROP TABLE IF EXISTS mood_history;")
    cursor.execute("DROP TABLE IF EXISTS chat_history;")
    cursor.execute("DROP TABLE IF EXISTS tasks;")
    cursor.execute("DROP TABLE IF EXISTS user_profiles;")
    cursor.execute("DROP TABLE IF EXISTS users;")

    # 1. Create Tables
    cursor.execute("""
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        country TEXT,
        timezone TEXT,
        created_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE user_profiles (
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        gender TEXT,
        last_period_date TEXT,
        cycle_length INTEGER,
        luteal_phase_length INTEGER,
        theme_preference TEXT DEFAULT 'light',
        analytics_theme TEXT DEFAULT 'cool',
        weekend_available INTEGER DEFAULT 0,
        productive_time_start TEXT DEFAULT '09:00',
        productive_time_end TEXT DEFAULT '17:00',
        priority_order TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)

    cursor.execute("""
    CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        title TEXT,
        raw_input TEXT,
        summary TEXT,
        category TEXT,
        priority TEXT,
        status TEXT,
        deadline TEXT,
        keywords TEXT,
        scheduled_date TEXT,
        duration TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)

    cursor.execute("""
    CREATE TABLE chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        role TEXT,
        content TEXT,
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)

    cursor.execute("""
    CREATE TABLE mood_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        label TEXT,
        happy INTEGER,
        sad INTEGER,
        stress INTEGER,
        fatigue INTEGER,
        energy INTEGER,
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)

    conn.commit()

    # 2. Extract and Populate Users & Profiles
    users_db_str = storage.get("concord_registered_users_db", "{}")
    users_db = json.loads(users_db_str)
    
    # Try to load general persistent user session details
    session_user_str = storage.get("concord_persistent_user_session", "null")
    session_user = json.loads(session_user_str)
    
    # Try to load local profile
    local_profile_str = storage.get("concord_local_profile", "null")
    local_profile = json.loads(local_profile_str)

    default_user_id = "usr_sharvibhavsar12"
    if session_user and "id" in session_user:
        default_user_id = session_user["id"]

    print("Migrating users and profiles...")
    
    # Seed default user if registration DB is completely empty
    if not users_db and session_user:
        email = session_user.get("email", "sharvibhavsar12@gmail.com")
        users_db[email] = session_user

    for email, u in users_db.items():
        uid = u.get("id", default_user_id)
        created_at = u.get("createdAt", datetime.now().isoformat())
        
        cursor.execute("""
        INSERT OR IGNORE INTO users (id, email, first_name, last_name, country, timezone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            uid,
            email.lower(),
            u.get("firstName", ""),
            u.get("lastName", ""),
            u.get("country", "IN"),
            u.get("timezone", "Asia/Kolkata"),
            created_at
        ))

        # Check if we have user profile
        prof = local_profile if (local_profile and local_profile.get("userId") == uid) else None
        if not prof and uid == "usr_sharvibhavsar12":
            # Seed profile if none exists
            prof = {
                "userId": uid,
                "displayName": f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() or "Sharvi Bhavsar",
                "gender": "female",
                "cycleLength": 28,
                "lutealPhaseLength": 14,
                "themePreference": "light",
                "analyticsTheme": "cool",
                "weekendAvailable": False
            }

        if prof:
            cursor.execute("""
            INSERT OR REPLACE INTO user_profiles (
                user_id, display_name, gender, last_period_date, cycle_length, 
                luteal_phase_length, theme_preference, analytics_theme, weekend_available,
                productive_time_start, productive_time_end, priority_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                uid,
                prof.get("displayName", ""),
                prof.get("gender", ""),
                prof.get("lastPeriodDate", None),
                prof.get("cycleLength", 28),
                prof.get("lutealPhaseLength", 14),
                prof.get("themePreference", "light"),
                prof.get("analyticsTheme", "cool"),
                1 if prof.get("weekendAvailable", False) else 0,
                prof.get("productiveTimeStart", "09:00"),
                prof.get("productiveTimeEnd", "17:00"),
                json.dumps(prof.get("priorityOrder", []))
            ))

    # 3. Extract and Populate Tasks
    tasks_str = storage.get("concord_local_tasks", "[]")
    tasks = json.loads(tasks_str)
    print(f"Migrating {len(tasks)} tasks...")

    for t in tasks:
        cursor.execute("""
        INSERT INTO tasks (
            user_id, title, raw_input, summary, category, priority, status, 
            deadline, keywords, scheduled_date, duration, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            t.get("userId", default_user_id),
            t.get("title", ""),
            t.get("rawInput", ""),
            t.get("summary", ""),
            t.get("category", "General"),
            t.get("priority", "medium"),
            t.get("status", "pending"),
            t.get("deadline", None),
            json.dumps(t.get("keywords", [])),
            t.get("scheduledDate", None),
            t.get("duration", "30"),
            t.get("createdAt", datetime.now().isoformat()),
            t.get("updatedAt", datetime.now().isoformat())
        ))

    # 4. Extract and Populate Chat History
    chat_str = storage.get("concord_local_chat", "[]")
    chat = json.loads(chat_str)
    print(f"Migrating {len(chat)} chat messages...")

    for c in chat:
        cursor.execute("""
        INSERT INTO chat_history (user_id, role, content, created_at)
        VALUES (?, ?, ?, ?)
        """, (
            default_user_id,
            c.get("role", "user"),
            c.get("content", ""),
            c.get("timestamp", datetime.now().isoformat())
        ))

    # 5. Extract and Populate Mood Logs
    mood_str = storage.get("concord_local_mood", "[]")
    mood = json.loads(mood_str)
    print(f"Migrating {len(mood)} mood entries...")

    for m in mood:
        val = m.get("value", {})
        if not val and "label" in m:
            val = m # Flat structure fallback
        cursor.execute("""
        INSERT INTO mood_history (user_id, label, happy, sad, stress, fatigue, energy, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            default_user_id,
            val.get("label", "neutral"),
            val.get("happy", 5),
            val.get("sad", 5),
            val.get("stress", 5),
            val.get("fatigue", 5),
            val.get("energy", 5),
            m.get("timestamp", datetime.now().isoformat())
        ))

    conn.commit()
    conn.close()

    print("\nSQLite Database generation completed successfully!")
    print(f"Database created at: {os.path.abspath(db_path)}")

if __name__ == "__main__":
    generate_sqlite()
