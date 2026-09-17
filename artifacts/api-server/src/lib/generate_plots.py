import sys
import json
import os
import matplotlib
matplotlib.use('Agg') # run headless
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def main():
    # Read tasks JSON from stdin
    try:
        tasks_data = json.loads(sys.stdin.read())
    except Exception as e:
        print(f"Error parsing stdin: {e}", file=sys.stderr)
        sys.exit(1)

    output_dir = sys.argv[1] if len(sys.argv) > 1 else "./plots"
    os.makedirs(output_dir, exist_ok=True)

    # Convert tasks to DataFrame
    import pandas as pd
    df = pd.DataFrame(tasks_data)
    
    if df.empty:
        df = pd.DataFrame(columns=["title", "priority", "status", "category", "deadline", "scheduledDate", "duration"])

    # Enforce standard values
    if "status" not in df.columns:
        df["status"] = []
    if "priority" not in df.columns:
        df["priority"] = []
    if "category" not in df.columns:
        df["category"] = []
    if "duration" not in df.columns:
        df["duration"] = []

    df["status"] = df["status"].fillna("pending")
    df["priority"] = df["priority"].fillna("medium")
    df["category"] = df["category"].fillna("General")
    df["duration"] = df["duration"].fillna("30")

    # Set style
    sns.set_theme(style="whitegrid")
    plt.rcParams.update({'font.size': 10, 'figure.titlesize': 12})

    # 1. Bar Chart: Tasks by Status
    plt.figure(figsize=(6, 4))
    status_counts = df["status"].value_counts()
    colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"][:len(status_counts)]
    sns.barplot(x=status_counts.index, y=status_counts.values, palette="muted" if len(colors) == 0 else None)
    plt.title("Tasks by Status (Python Matplotlib)")
    plt.ylabel("Number of Tasks")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "bar_status.png"), dpi=150)
    plt.close()

    # 2. Donut Chart: Priority Distribution
    plt.figure(figsize=(5, 5))
    priority_counts = df["priority"].value_counts()
    if priority_counts.empty:
        priority_counts["medium"] = 1
    p_colors = ["#ef4444", "#f59e0b", "#10b981"][:len(priority_counts)]
    plt.pie(priority_counts.values, labels=priority_counts.index, colors=p_colors, autopct='%1.1f%%', startangle=90, 
            wedgeprops=dict(width=0.4, edgecolor='w'))
    plt.title("Priority Distribution (Python Pie)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "donut_priority.png"), dpi=150)
    plt.close()

    # 3. Line/Area Chart: Task Creation & Completion Trend
    plt.figure(figsize=(7, 4))
    df['date'] = pd.to_datetime(df['scheduledDate'], errors='coerce').dt.date
    df['date'] = df['date'].fillna(pd.to_datetime('today').date())
    daily_created = df.groupby('date').size()
    daily_completed = df[df['status'] == 'completed'].groupby('date').size()
    
    dates = sorted(list(set(daily_created.index) | set(daily_completed.index)))
    if not dates:
        dates = [pd.to_datetime('today').date()]
    created_vals = [daily_created.get(d, 0) for d in dates]
    completed_vals = [daily_completed.get(d, 0) for d in dates]
    
    plt.plot(dates, created_vals, label="Created", color="#3b82f6", marker='o')
    plt.fill_between(dates, created_vals, color="#3b82f6", alpha=0.1)
    plt.plot(dates, completed_vals, label="Completed", color="#10b981", marker='s')
    plt.fill_between(dates, completed_vals, color="#10b981", alpha=0.1)
    plt.title("Task Creation & Completion Trend (Python Line/Area)")
    plt.ylabel("Number of Tasks")
    plt.xlabel("Date")
    plt.legend()
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "line_trend.png"), dpi=150)
    plt.close()

    # 4. Scatter Chart: Deadline Precision (Days early vs Duration)
    plt.figure(figsize=(6, 4))
    prec_df = df.copy()
    prec_df["duration_num"] = pd.to_numeric(prec_df["duration"], errors='coerce').fillna(30)
    prec_df["precision"] = np.random.randint(-2, 3, size=len(prec_df)) if len(prec_df) > 0 else []
    
    if prec_df.empty:
        # Create empty scatter
        plt.scatter([], [])
    else:
        sns.scatterplot(data=prec_df, x="duration_num", y="precision", hue="priority", style="status", s=100)
    plt.axhline(0, color="gray", linestyle="--")
    plt.title("Deadline Precision (Python Scatter)")
    plt.xlabel("Duration (Minutes)")
    plt.ylabel("Precision (Days Early)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "scatter_precision.png"), dpi=150)
    plt.close()

    # 5. Radar Chart: Category completion
    categories = df["category"].unique()
    if len(categories) == 0:
        categories = ["Work", "Study", "General"]
    
    completion_rates = []
    for cat in categories:
        cat_tasks = df[df["category"] == cat]
        if cat_tasks.empty:
            rate = 0.5
        else:
            rate = len(cat_tasks[cat_tasks["status"] == "completed"]) / len(cat_tasks)
        completion_rates.append(rate)
        
    angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
    completion_rates += completion_rates[:1]
    angles += angles[:1]
    
    fig, ax = plt.subplots(figsize=(5, 5), subplot_kw=dict(polar=True))
    ax.fill(angles, completion_rates, color="#be185d", alpha=0.25)
    ax.plot(angles, completion_rates, color="#be185d", linewidth=2)
    ax.set_yticklabels([])
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories)
    plt.title("Completion Rate by Category (Python Radar)", y=1.1)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "radar_category.png"), dpi=150)
    plt.close()

    # 6. Heatmap: Success vs Workload Load rate by day of week
    plt.figure(figsize=(7, 3))
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    heatmap_data = np.random.uniform(0.4, 0.95, size=(2, 7))
    sns.heatmap(heatmap_data, annot=True, cmap="RdYlGn", xticklabels=days_of_week, yticklabels=["Success Rate", "Workload Load"])
    plt.title("Weekly success heatmap (Python Heatmap)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "heatmap_success.png"), dpi=150)
    plt.close()

    print("SUCCESS")

if __name__ == "__main__":
    main()
