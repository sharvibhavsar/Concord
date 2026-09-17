export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }
}

export interface TaskItem {
  id: string;
  title: string;
  priority?: "low" | "medium" | "high" | string;
  status: "pending" | "in_progress" | "completed";
  deadline?: string | null;
}

export function checkNotificationRules(
  tasks: TaskItem[],
  notificationsEnabled: boolean = true
) {
  if (!notificationsEnabled) return;

  const now = new Date();
  const notifiedKeysKey = "concord_notified_keys";
  const notifiedKeys: Record<string, boolean> = JSON.parse(
    localStorage.getItem(notifiedKeysKey) ?? "{}"
  );

  // 1. High priority task near 1 hour before deadline
  tasks.forEach((task) => {
    if (task.status !== "completed" && task.priority === "high" && task.deadline) {
      const deadlineDate = new Date(task.deadline);
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      // If deadline is within 50 to 70 minutes away (around 1 hr before)
      if (diffMinutes >= 0 && diffMinutes <= 60) {
        const notifKey = `high_priority_${task.id}_${deadlineDate.toISOString().slice(0, 13)}`;
        if (!notifiedKeys[notifKey]) {
          sendBrowserNotification("High Priority Task Reminder", {
            body: `"${task.title}" is due in approximately 1 hour!`,
            tag: notifKey,
          });
          notifiedKeys[notifKey] = true;
        }
      }
    }
  });

  // 2. All daily tasks finished celebration
  if (tasks.length > 0) {
    const todayStr = now.toISOString().slice(0, 10);
    const todayTasks = tasks.filter((t) => {
      if (!t.deadline) return true;
      return t.deadline.startsWith(todayStr);
    });

    if (todayTasks.length > 0 && todayTasks.every((t) => t.status === "completed")) {
      const completionKey = `daily_completion_${todayStr}`;
      if (!notifiedKeys[completionKey]) {
        sendBrowserNotification("All Tasks Completed! 🎉", {
          body: "Great job! You have finished all tasks scheduled for today. Keep up the amazing work!",
          tag: completionKey,
        });
        notifiedKeys[completionKey] = true;
      }
    }
  }

  // 3. 1st of the month drive to analysis page
  if (now.getDate() === 1) {
    const monthKey = `monthly_analytics_${now.getFullYear()}_${now.getMonth() + 1}`;
    if (!notifiedKeys[monthKey]) {
      sendBrowserNotification("Monthly Performance Review", {
        body: "Happy new month! Visit your Analytics page to review your progress and achievements from last month.",
        tag: monthKey,
      });
      notifiedKeys[monthKey] = true;
    }
  }

  localStorage.setItem(notifiedKeysKey, JSON.stringify(notifiedKeys));
}
