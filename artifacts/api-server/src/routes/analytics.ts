import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, usersTable, moodHistoryTable } from "@workspace/db";
import { startOfWeek, format, subWeeks, startOfDay, endOfDay, subDays } from "date-fns";
import { execSync } from "child_process";
import path from "path";

const router: IRouter = Router();

// GET /analytics
router.get("/analytics", async (req, res): Promise<void> => {
  const userId = req.isAuthenticated() ? req.user.id : null;

  const all = userId
    ? await db.select().from(tasksTable).where(eq(tasksTable.userId, userId))
    : await db.select().from(tasksTable);

  try {
    const scriptPath = path.join(__dirname, "../lib/generate_plots.py");
    const publicPlotsDir = path.join(__dirname, "../../../concord/public/python_plots");
    const pythonCmd = `python "${scriptPath}" "${publicPlotsDir}"`;
    execSync(pythonCmd, {
      input: JSON.stringify(all.map(t => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        category: t.category,
        deadline: t.deadline ? t.deadline.toISOString() : null,
        scheduledDate: t.scheduledDate,
        duration: t.duration || "30",
      }))),
      encoding: "utf-8"
    });
  } catch (err) {
    console.error("Failed to run python analytics script:", err);
  }

  const now = new Date();

  // ── Totals ──────────────────────────────────────────────────────
  const total = all.length;
  const completed = all.filter((t) => t.status === "completed").length;
  const inProgress = all.filter((t) => t.status === "in_progress").length;
  const pending = all.filter((t) => t.status === "pending").length;
  const overdue = all.filter(
    (t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed",
  ).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── By priority ─────────────────────────────────────────────────
  const priorities = ["high", "medium", "low"] as const;
  const byPriority = priorities.map((p) => {
    const tasksWithPriority = all.filter((t) => t.priority === p);
    return {
      priority: p,
      total: tasksWithPriority.length,
      completed: tasksWithPriority.filter((t) => t.status === "completed").length,
    };
  });

  // ── By category ─────────────────────────────────────────────────
  const catMap: Record<string, { total: number; completed: number }> = {};
  for (const task of all) {
    const cat = task.category ?? "other";
    if (!catMap[cat]) catMap[cat] = { total: 0, completed: 0 };
    catMap[cat].total++;
    if (task.status === "completed") catMap[cat].completed++;
  }
  const byCategory = Object.entries(catMap)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total);

  // ── Weekly completion (last 8 weeks) ────────────────────────────
  const weeklyCompletion: { week: string; completed: number; created: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekLabel = format(weekStart, "MMM d");

    const completedInWeek = all.filter((t) => {
      if (t.status !== "completed") return false;
      const updated = new Date(t.updatedAt);
      return updated >= weekStart && updated <= weekEnd;
    }).length;

    const createdInWeek = all.filter((t) => {
      const created = new Date(t.createdAt);
      return created >= weekStart && created <= weekEnd;
    }).length;

    weeklyCompletion.push({ week: weekLabel, completed: completedInWeek, created: createdInWeek });
  }

  // ── Daily heatmap (last 90 days, completed tasks) ────────────────
  const dailyHeatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const day = subDays(now, i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const count = all.filter((t) => {
      if (t.status !== "completed") return false;
      const updated = new Date(t.updatedAt);
      return updated >= dayStart && updated <= dayEnd;
    }).length;
    dailyHeatmap.push({ date: format(day, "yyyy-MM-dd"), count });
  }

  // ── Deadline precision (tasks with deadlines that are completed) ──
  const deadlinePrecision: { title: string; daysEarly: number; priority: string }[] = [];
  let onTimeCount = 0;
  let lateCount = 0;

  for (const task of all) {
    if (task.status === "completed" && task.deadline) {
      const deadlineDate = new Date(task.deadline);
      const completedDate = new Date(task.updatedAt);
      const daysEarly = (deadlineDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      deadlinePrecision.push({
        title: task.title.length > 30 ? task.title.slice(0, 27) + "..." : task.title,
        daysEarly: Math.round(daysEarly * 10) / 10,
        priority: task.priority,
      });
      if (daysEarly >= 0) onTimeCount++;
      else lateCount++;
    }
  }

  // ── By status over time (status distribution per week) ───────────
  const weeklyStatus: { week: string; pending: number; inProgress: number; completed: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekLabel = format(weekStart, "MMM d");

    const inWeek = all.filter((t) => {
      const created = new Date(t.createdAt);
      return created >= weekStart && created <= weekEnd;
    });

    weeklyStatus.push({
      week: weekLabel,
      pending: inWeek.filter((t) => t.status === "pending").length,
      inProgress: inWeek.filter((t) => t.status === "in_progress").length,
      completed: inWeek.filter((t) => t.status === "completed").length,
    });
  }

  // ── Category completion rate (for radar) ─────────────────────────
  const categoryRadar = byCategory.map((c) => ({
    category: c.category.charAt(0).toUpperCase() + c.category.slice(1),
    completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
    total: c.total,
  }));

  // ── User Metrics (Admin) ─────────────────────────────────────────
  const allUsers = await db.select().from(usersTable);
  const totalUsers = allUsers.length;

  const distinctUserIds = await db
    .select({ userId: tasksTable.userId })
    .from(tasksTable)
    .groupBy(tasksTable.userId);
  const activeUsers = distinctUserIds.filter((d) => d.userId !== null).length;

  const userActivity = allUsers.map((u) => {
    const taskCount = all.filter((t) => t.userId === u.id).length;
    return {
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "Unknown User",
      email: u.email,
      taskCount,
    };
  }).sort((a, b) => b.taskCount - a.taskCount);

  // ── Wellness Metrics ─────────────────────────────────────────────
  const allMoods = userId
    ? await db.select().from(moodHistoryTable).where(eq(moodHistoryTable.userId, userId))
    : await db.select().from(moodHistoryTable);

  const moodMap: Record<string, number> = {};
  for (const m of allMoods) {
    const lbl = m.label || "neutral";
    moodMap[lbl] = (moodMap[lbl] ?? 0) + 1;
  }
  const moodDistribution = Object.entries(moodMap).map(([label, count]) => ({
    label,
    count,
  }));

  // Calculate Average Tasks Completed on days with specific mood
  const dailyCompletions: Record<string, number> = {};
  for (const t of all) {
    if (t.status === "completed") {
      const dateStr = format(new Date(t.updatedAt), "yyyy-MM-dd");
      dailyCompletions[dateStr] = (dailyCompletions[dateStr] || 0) + 1;
    }
  }

  const moodProductivityMap: Record<string, { totalTasks: number; count: number }> = {};
  for (const m of allMoods) {
    const lbl = m.label || "neutral";
    const dateStr = format(new Date(m.createdAt), "yyyy-MM-dd");
    const completedOnDay = dailyCompletions[dateStr] || 0;
    if (!moodProductivityMap[lbl]) {
      moodProductivityMap[lbl] = { totalTasks: 0, count: 0 };
    }
    moodProductivityMap[lbl].totalTasks += completedOnDay;
    moodProductivityMap[lbl].count += 1;
  }

  const moodProductivity = Object.entries(moodProductivityMap).map(([label, data]) => ({
    label,
    avgCompleted: data.count > 0 ? Math.round((data.totalTasks / data.count) * 10) / 10 : 0
  }));

  res.json({
    total,
    completed,
    inProgress,
    pending,
    overdue,
    completionRate,
    byPriority,
    byCategory,
    weeklyCompletion,
    weeklyStatus,
    dailyHeatmap,
    onTimeCount,
    lateCount,
    deadlinePrecision,
    categoryRadar,
    userMetrics: {
      totalUsers,
      activeUsers,
      userActivity,
    },
    wellness: {
      moodDistribution,
      moodProductivity,
    }
  });
});

export default router;
