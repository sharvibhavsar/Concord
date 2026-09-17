import subprocess
import os
import sys
from dotenv import load_dotenv

def run_pipeline():
    print("==================================================")
    print("Concord Local Analytics & Reports Automation Tool")
    print("==================================================")

    # Load environment variables
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")

    # 1. Run SQLite Database Generator (Optional if PostgreSQL is used)
    if db_url:
        print("\n[Notice] DATABASE_URL found. Bypassing SQLite database snapshot generation...")
    else:
        print("\n[Step 1/2] Generating concord.db SQLite snapshot...")
        p1 = subprocess.run([sys.executable, "scripts/generate_sqlite.py"], capture_output=False)
        if p1.returncode != 0:
            print("Error during SQLite generation. Aborting pipeline.")
            sys.exit(1)

    # 2. Run Data Analytics Report Exporter
    print("\n[Step 2/2] Running analytics report engine...")
    p2 = subprocess.run([sys.executable, "scripts/generate_reports.py"], capture_output=False)
    if p2.returncode != 0:
        print("Error during reports generation. Aborting pipeline.")
        sys.exit(1)

    print("\n==================================================")
    print("All tasks completed successfully!")
    print("Check the 'reports/' folder for all outputs:")
    print(" - concord_report.xlsx (Excel metrics dashboard)")
    print(" - users.csv, tasks.csv, mood_history.csv, etc.")
    print(" - 10+ visual charts (PNG)")
    print(" - Queries are available in 'queries.sql'")
    print("==================================================")

if __name__ == "__main__":
    run_pipeline()
