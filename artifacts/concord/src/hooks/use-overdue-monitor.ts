import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Task {
  id: number;
  title: string;
  deadline: string | null;
  status: string;
  overdueNotifiedAt: string | null;
  priority: string;
}

export function useOverdueMonitor() {
  const [overdueTask, setOverdueTask] = useState<Task | null>(null);

  const { data: tasks, refetch } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/tasks`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000, // poll every minute
  });

  useEffect(() => {
    if (!tasks) return;
    const now = Date.now();
    const overdue = tasks.find((t) =>
      t.deadline &&
      new Date(t.deadline).getTime() < now &&
      t.status !== "completed" &&
      !t.overdueNotifiedAt
    );
    if (overdue) setOverdueTask(overdue);
  }, [tasks]);

  const dismissTask = async (taskId: number, action: "reschedule" | "remove", newDeadline?: string) => {
    if (action === "reschedule" && newDeadline) {
      await fetch(`${BASE_URL}/api/tasks/${taskId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deadline: newDeadline }),
      });
    } else if (action === "remove") {
      await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      });
    }
    // Mark as notified either way
    await fetch(`${BASE_URL}/api/tasks/${taskId}/notify-overdue`, {
      method: "PATCH",
      credentials: "include",
    });
    setOverdueTask(null);
    refetch();
  };

  return { overdueTask, dismissTask };
}
