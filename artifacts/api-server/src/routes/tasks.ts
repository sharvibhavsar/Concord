import { Router, type IRouter } from "express";
import { eq, and, isNotNull, lt, type SQL } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  ParseTaskBody,
  GetTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  UpdateTaskStatusParams,
  UpdateTaskStatusBody,
} from "@workspace/api-zod";
import { parseTaskInput, parseMultiTaskInput } from "../lib/nlp";

const router: IRouter = Router();

// POST /tasks/parse — NLP parse preview (no auth required)
router.post("/tasks/parse", async (req, res): Promise<void> => {
  const parsed = ParseTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = parseTaskInput(parsed.data.rawInput);
  res.json(result);
});

// POST /tasks/parse-multi — parse chained tasks into an array
router.post("/tasks/parse-multi", async (req, res): Promise<void> => {
  const parsed = ParseTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const results = parseMultiTaskInput(parsed.data.rawInput);
  res.json(results);
});

// GET /tasks/summary
router.get("/tasks/summary", async (req, res): Promise<void> => {
  const now = new Date();
  const userId = req.isAuthenticated() ? req.user.id : null;

  const all = await db
    .select()
    .from(tasksTable)
    .where(userId ? eq(tasksTable.userId, userId) : undefined);

  const total = all.length;
  const pending = all.filter((t) => t.status === "pending").length;
  const inProgress = all.filter((t) => t.status === "in_progress").length;
  const completed = all.filter((t) => t.status === "completed").length;

  const overdue = all.filter(
    (t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed",
  ).length;

  const categoryMap: Record<string, number> = {};
  for (const task of all) {
    const cat = task.category ?? "uncategorised";
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
  }
  const byCategory = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
  }));

  const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = all
    .filter(
      (t) =>
        t.deadline &&
        new Date(t.deadline) >= now &&
        new Date(t.deadline) <= oneWeek &&
        t.status !== "completed",
    )
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    )
    .slice(0, 5)
    .map(serializeTask);

  res.json({
    total,
    pending,
    inProgress,
    completed,
    overdue,
    byCategory,
    upcomingDeadlines,
  });
});

// GET /tasks
router.get("/tasks", async (req, res): Promise<void> => {
  const queryParsed = GetTasksQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const { status, category, priority } = queryParsed.data;
  const userId = req.isAuthenticated() ? req.user.id : null;
  const conditions: SQL[] = [];

  if (userId) conditions.push(eq(tasksTable.userId, userId));
  if (status) conditions.push(eq(tasksTable.status, status as "pending" | "in_progress" | "completed"));
  if (category) conditions.push(eq(tasksTable.category, category));
  if (priority) conditions.push(eq(tasksTable.priority, priority as "low" | "medium" | "high"));

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tasksTable.createdAt);

  res.json(tasks.map(serializeTask));
});

// POST /tasks
router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const data = parsed.data;
  const [task] = await db
    .insert(tasksTable)
    .values({
      userId,
      title: data.title,
      rawInput: data.rawInput,
      summary: data.summary ?? null,
      category: data.category ?? null,
      priority: (data.priority as "low" | "medium" | "high") ?? "medium",
      status: (data.status as "pending" | "in_progress" | "completed") ?? "pending",
      deadline: data.deadline ? new Date(data.deadline) : null,
      keywords: data.keywords ?? [],
      scheduledDate: data.scheduledDate ?? null,
      duration: data.duration ?? "30",
    })
    .returning();
  res.status(201).json(serializeTask(task));
});

// GET /tasks/:id
router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const conditions: SQL[] = [eq(tasksTable.id, params.data.id)];
  if (userId) conditions.push(eq(tasksTable.userId, userId));

  const results = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions));

  if (results.length === 0) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = results[0];
  res.json(serializeTask(task));
});

// PATCH /tasks/:id
router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const data = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
  if (data.keywords !== undefined) updateData.keywords = data.keywords;
  if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate;
  if (data.duration !== undefined) updateData.duration = data.duration;

  const conditions: SQL[] = [eq(tasksTable.id, params.data.id)];
  if (userId) conditions.push(eq(tasksTable.userId, userId));

  const [task] = await db
    .update(tasksTable)
    .set(updateData)
    .where(and(...conditions))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(serializeTask(task));
});

// PATCH /tasks/:id/notify-overdue
router.patch("/tasks/:id/notify-overdue", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const userId = req.user.id;
  const [task] = await db
    .update(tasksTable)
    .set({ overdueNotifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(serializeTask(task));
});

// PATCH /tasks/:id/reschedule
router.patch("/tasks/:id/reschedule", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const { deadline } = req.body as { deadline?: string };
  if (!deadline) {
    res.status(400).json({ error: "deadline is required" });
    return;
  }

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    res.status(400).json({ error: "deadline must be a valid ISO date" });
    return;
  }

  const userId = req.user.id;
  const [task] = await db
    .update(tasksTable)
    .set({ deadline: deadlineDate, overdueNotifiedAt: null, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(serializeTask(task));
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const conditions: SQL[] = [eq(tasksTable.id, params.data.id)];
  if (userId) conditions.push(eq(tasksTable.userId, userId));

  const [task] = await db
    .delete(tasksTable)
    .where(and(...conditions))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

// PATCH /tasks/:id/status
router.patch("/tasks/:id/status", async (req, res): Promise<void> => {
  const params = UpdateTaskStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const conditions: SQL[] = [eq(tasksTable.id, params.data.id)];
  if (userId) conditions.push(eq(tasksTable.userId, userId));

  const [task] = await db
    .update(tasksTable)
    .set({ status: parsed.data.status as "pending" | "in_progress" | "completed", updatedAt: new Date() })
    .where(and(...conditions))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(serializeTask(task));
});

function serializeTask(task: typeof tasksTable.$inferSelect) {
  return {
    ...task,
    deadline: task.deadline ? task.deadline.toISOString() : null,
    scheduledDate: task.scheduledDate ?? null,
    duration: task.duration ?? "30",
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    keywords: task.keywords ?? [],
  };
}


export default router;
