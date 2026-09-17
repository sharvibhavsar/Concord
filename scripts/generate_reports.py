import os
import json
import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# Set styling
sns.set_theme(style="whitegrid")
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.size'] = 10

def generate_reports():
    print("--------------------------------------------------")
    print("Concord Data Analytics Report Generator")
    print("--------------------------------------------------")

    reports_dir = "reports"
    os.makedirs(reports_dir, exist_ok=True)

    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(dotenv_path)
    db_url = os.getenv("DATABASE_URL")
    
    conn = None
    is_postgres = False
    
    if db_url:
        print("DATABASE_URL found, attempting to connect to PostgreSQL...")
        try:
            if "localhost" in db_url:
                db_url = db_url.replace("localhost", "127.0.0.1")
            conn = psycopg2.connect(db_url)
            is_postgres = True
            print("Successfully connected to PostgreSQL database!")
        except Exception as e:
            print(f"PostgreSQL connection failed: {e}")
            conn = None

    if conn is None:
        db_path = "concord.db"
        if not os.path.exists(db_path):
            print(f"Error: Could not find database file '{db_path}' and PostgreSQL connection failed.")
            return
        print(f"Connecting to SQLite fallback database '{db_path}'...")
        conn = sqlite3.connect(db_path)

    # 1. Load tables into Pandas DataFrames
    df_users = pd.read_sql_query("SELECT * FROM users", conn)
    df_profiles = pd.read_sql_query("SELECT * FROM user_profiles", conn)
    df_tasks = pd.read_sql_query("SELECT * FROM tasks", conn)
    
    # Query chat history / messages
    df_chat = pd.DataFrame()
    for table_name in ["chat_messages", "chat_history"]:
        try:
            df_chat = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            break
        except Exception:
            continue
            
    df_mood = pd.read_sql_query("SELECT * FROM mood_history", conn)

    if df_tasks.empty:
        print("Warning: Tasks table is empty. Generating placeholder data analysis...")
        conn.close()
        return

    print("Running exploratory data analysis...")

    # Data transformations
    df_tasks['created_at_dt'] = pd.to_datetime(df_tasks['created_at'], format='mixed', errors='coerce', utc=True)
    df_tasks['updated_at_dt'] = pd.to_datetime(df_tasks['updated_at'], format='mixed', errors='coerce', utc=True)
    df_tasks['created_date'] = df_tasks['created_at_dt'].dt.date
    df_tasks['completed_date'] = df_tasks['updated_at_dt'].dt.date
    df_tasks['weekday'] = df_tasks['created_at_dt'].dt.day_name()
    
    # 2. Calculate Productivity & Workload Metrics
    total_tasks = len(df_tasks)
    completed_tasks = len(df_tasks[df_tasks['status'] == 'completed'])
    pending_tasks = len(df_tasks[df_tasks['status'] != 'completed'])
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

    print(f"Metrics: {total_tasks} total tasks, {completed_tasks} completed. Completion Rate: {completion_rate:.1f}%")

    # 3. Create Plots & Save to reports/
    print("Generating visualizations...")

    # Chart 1: Task Status Distribution
    plt.figure(figsize=(6, 5))
    status_counts = df_tasks['status'].value_counts()
    colors = ['#10b981', '#3b82f6', '#f59e0b'] # Emerald, Blue, Amber
    plt.pie(status_counts, labels=status_counts.index.str.replace('_', ' ').str.capitalize(), autopct='%1.1f%%', colors=colors[:len(status_counts)], startangle=140, wedgeprops={'edgecolor': 'white'})
    plt.title('Task Status Distribution')
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'task_status_distribution.png'), dpi=150)
    plt.close()

    # Chart 2: Task Priority Distribution
    plt.figure(figsize=(6, 5))
    priority_counts = df_tasks['priority'].value_counts().reindex(['low', 'medium', 'high']).fillna(0)
    sns.barplot(x=priority_counts.index, y=priority_counts.values, palette=['#10b981', '#f59e0b', '#ef4444'])
    plt.title('Task Priority Distribution')
    plt.xlabel('Priority')
    plt.ylabel('Number of Tasks')
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'task_priority_distribution.png'), dpi=150)
    plt.close()

    # Chart 3: Completion Rate by Priority
    plt.figure(figsize=(7, 5))
    prio_comp = df_tasks.groupby('priority').apply(lambda x: (x['status'] == 'completed').mean() * 100).reindex(['low', 'medium', 'high']).fillna(0)
    sns.barplot(x=prio_comp.index, y=prio_comp.values, palette=['#10b981', '#f59e0b', '#ef4444'])
    plt.title('Completion Rate per Priority (%)')
    plt.ylabel('Completion Rate (%)')
    plt.ylim(0, 100)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'task_priority_completion_rate.png'), dpi=150)
    plt.close()

    # Chart 4: Task Category Distribution
    plt.figure(figsize=(8, 5))
    cat_counts = df_tasks['category'].value_counts()
    sns.barplot(y=cat_counts.index, x=cat_counts.values, palette="crest")
    plt.title('Tasks by Category')
    plt.xlabel('Number of Tasks')
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'task_category_distribution.png'), dpi=150)
    plt.close()

    # Chart 5: Category Completion Rate
    plt.figure(figsize=(8, 5))
    cat_comp = df_tasks.groupby('category').apply(lambda x: (x['status'] == 'completed').mean() * 100).sort_values(ascending=False)
    sns.barplot(y=cat_comp.index, x=cat_comp.values, palette="viridis")
    plt.title('Completion Rate by Category (%)')
    plt.xlabel('Completion Rate (%)')
    plt.xlim(0, 100)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'task_category_completion_rate.png'), dpi=150)
    plt.close()

    # Chart 6: Daily Task Creation Trend
    plt.figure(figsize=(10, 5))
    creation_trend = df_tasks.groupby('created_date').size()
    plt.plot(creation_trend.index, creation_trend.values, marker='o', color='#3b82f6', linewidth=2)
    plt.title('Daily Task Creation Trend')
    plt.xlabel('Date')
    plt.ylabel('Tasks Created')
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'daily_task_creation_trend.png'), dpi=150)
    plt.close()

    # Chart 7: Weekly Productivity Trend
    plt.figure(figsize=(10, 5))
    df_tasks['week'] = df_tasks['created_at_dt'].dt.to_period('W').astype(str)
    weekly_comp = df_tasks.groupby('week').apply(lambda x: (x['status'] == 'completed').sum())
    plt.bar(weekly_comp.index, weekly_comp.values, color='#8b5cf6')
    plt.title('Weekly Task Completion Trend')
    plt.xlabel('Week')
    plt.ylabel('Tasks Completed')
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'weekly_productivity_trend.png'), dpi=150)
    plt.close()

    # Chart 8: Calendar Workload Distribution
    plt.figure(figsize=(10, 5))
    workload = df_tasks['weekday'].value_counts().reindex(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).fillna(0)
    sns.barplot(x=workload.index, y=workload.values, palette="magma")
    plt.title('Workload Distribution by Day of Week')
    plt.ylabel('Tasks Scheduled')
    plt.tight_layout()
    plt.savefig(os.path.join(reports_dir, 'calendar_workload_distribution.png'), dpi=150)
    plt.close()

    # Chart 9: Mood Frequency Distribution
    if not df_mood.empty:
        plt.figure(figsize=(6, 5))
        mood_counts = df_mood['label'].value_counts()
        sns.barplot(x=mood_counts.index, y=mood_counts.values, palette="pastel")
        plt.title('Mood Log Distribution')
        plt.ylabel('Frequency')
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, 'mood_distribution.png'), dpi=150)
        plt.close()

        # Chart 10: Mood vs Task Completion
        df_mood['date'] = pd.to_datetime(df_mood['created_at'], format='mixed', errors='coerce', utc=True).dt.date
        daily_completed = df_tasks[df_tasks['status'] == 'completed'].groupby('completed_date').size().reset_index(name='tasks')
        daily_completed.rename(columns={'completed_date': 'date'}, inplace=True)
        mood_comp = pd.merge(df_mood, daily_completed, on='date', how='left').fillna(0)
        
        plt.figure(figsize=(7, 5))
        sns.boxplot(data=mood_comp, x='label', y='tasks', palette="coolwarm")
        plt.title('Daily Completed Tasks by Logged Mood')
        plt.xlabel('Mood')
        plt.ylabel('Completed Tasks')
        plt.tight_layout()
        plt.savefig(os.path.join(reports_dir, 'mood_vs_task_completion.png'), dpi=150)
        plt.close()

    # Chart 11: Women's Cycle Phase Productivity (if enabled)
    female_profiles = df_profiles[df_profiles['gender'] == 'female']
    if not female_profiles.empty and not df_tasks.empty:
        plt.figure(figsize=(8, 5))
        cycle_len = female_profiles.iloc[0]['cycle_length'] or 28
        luteal_len = female_profiles.iloc[0]['luteal_phase_length'] or 14
        last_period_str = female_profiles.iloc[0]['last_period_date']
        
        if last_period_str:
            last_period = pd.to_datetime(last_period_str, format='mixed', errors='coerce', utc=True)
            phases = []
            
            for idx, row in df_tasks.iterrows():
                task_date = row['created_at_dt']
                days_since = (task_date - last_period).days
                day_in_cycle = (days_since % cycle_len) + 1
                
                # Menstrual: 1-5, Follicular: 6 to cycle-luteal-1, Ovulation: cycle-luteal, Luteal: remaining
                menstrual_end = 5
                follicular_end = cycle_len - luteal_len - 1
                ovulatory_day = cycle_len - luteal_len
                
                phase = "Luteal"
                if day_in_cycle <= menstrual_end:
                    phase = "Menstrual"
                elif day_in_cycle <= follicular_end:
                    phase = "Follicular"
                elif day_in_cycle == ovulatory_day:
                    phase = "Ovulatory"
                phases.append(phase)
                
            df_tasks['cycle_phase'] = phases
            phase_comp = df_tasks.groupby('cycle_phase').apply(lambda x: (x['status'] == 'completed').mean() * 100).reindex(['Menstrual', 'Follicular', 'Ovulatory', 'Luteal']).fillna(0)
            
            sns.barplot(x=phase_comp.index, y=phase_comp.values, palette="rocket")
            plt.title('Completion Rate by Menstrual Cycle Phase (%)')
            plt.ylabel('Completion Rate (%)')
            plt.ylim(0, 100)
            plt.tight_layout()
            plt.savefig(os.path.join(reports_dir, 'cycle_phase_completion.png'), dpi=150)
            plt.close()

    # 4. Export Datasets to CSV and Excel
    print("Exporting datasets...")
    
    # Save individual tables to CSV
    df_users.to_csv(os.path.join(reports_dir, 'users.csv'), index=False)
    df_profiles.to_csv(os.path.join(reports_dir, 'user_profiles.csv'), index=False)
    df_tasks.to_csv(os.path.join(reports_dir, 'tasks.csv'), index=False)
    if not df_mood.empty:
        df_mood.to_csv(os.path.join(reports_dir, 'mood_history.csv'), index=False)
    if not df_chat.empty:
        df_chat.to_csv(os.path.join(reports_dir, 'chat_history.csv'), index=False)

    # Save summary stats Excel Workbook
    excel_path = os.path.join(reports_dir, 'concord_report.xlsx')
    
    # Strip timezone info so openpyxl doesn't fail
    for df in [df_users, df_profiles, df_tasks, df_mood, df_chat]:
        if df is not None and not df.empty:
            for col in df.columns:
                if pd.api.types.is_datetime64tz_dtype(df[col]):
                    df[col] = df[col].dt.tz_localize(None)
                elif pd.api.types.is_datetime64_any_dtype(df[col]):
                    df[col] = df[col].dt.tz_localize(None)

    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        df_users.to_excel(writer, sheet_name='Users', index=False)
        df_profiles.to_excel(writer, sheet_name='User Profiles', index=False)
        df_tasks.drop(columns=['created_at_dt', 'updated_at_dt']).to_excel(writer, sheet_name='Tasks', index=False)
        
        # Add summary sheet
        summary_data = {
            'Metric': ['Total Tasks', 'Completed Tasks', 'Pending Tasks', 'Completion Rate (%)'],
            'Value': [total_tasks, completed_tasks, pending_tasks, round(completion_rate, 2)]
        }
        df_sum = pd.DataFrame(summary_data)
        df_sum.to_excel(writer, sheet_name='Productivity Summary', index=False)

        if not df_mood.empty:
            df_mood.to_excel(writer, sheet_name='Mood History', index=False)
        if not df_chat.empty:
            df_chat.to_excel(writer, sheet_name='Chat History', index=False)

    print(f"Summary datasets saved in: {reports_dir}/")
    print(f"Excel workbook created at: {os.path.abspath(excel_path)}")
    print("\nReports generation completed successfully!")

    conn.close()

if __name__ == "__main__":
    generate_reports()
