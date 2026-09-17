import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, chatMessagesTable, tasksTable } from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { generateSmartChatResponse, type TaskRecord } from "../lib/nlp";

const router: IRouter = Router();

// GET /chat
router.get("/chat", async (req, res): Promise<void> => {
  const userId = req.isAuthenticated() ? req.user.id : null;

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(userId ? eq(chatMessagesTable.userId, userId) : undefined)
    .orderBy(chatMessagesTable.createdAt);

  res.json(
    messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

// POST /chat
router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const userContent = parsed.data.content;

  // Save user message
  await db.insert(chatMessagesTable).values({
    userId,
    role: "user",
    content: userContent,
  });

  // Fetch full task list for smart DB-aware responses
  const now = new Date();
  const allTasks = userId
    ? await db.select().from(tasksTable).where(eq(tasksTable.userId, userId))
    : await db.select().from(tasksTable);

  const taskRecords: TaskRecord[] = allTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    category: t.category,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    summary: t.summary,
  }));

  const context = {
    taskCount: allTasks.length,
    pendingCount: allTasks.filter((t) => t.status === "pending").length,
    inProgressCount: allTasks.filter((t) => t.status === "in_progress").length,
    completedCount: allTasks.filter((t) => t.status === "completed").length,
    overdueCount: allTasks.filter(
      (t) =>
        t.deadline &&
        new Date(t.deadline) < now &&
        t.status !== "completed",
    ).length,
  };

  const assistantContent = generateSmartChatResponse(userContent, taskRecords, context);

  // Save assistant message and return it
  const [assistantMsg] = await db
    .insert(chatMessagesTable)
    .values({ userId, role: "assistant", content: assistantContent })
    .returning();

  res.json({
    ...assistantMsg,
    createdAt: assistantMsg.createdAt.toISOString(),
  });
});

export default router;
