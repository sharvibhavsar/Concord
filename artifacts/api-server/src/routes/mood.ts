import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, moodHistoryTable } from "@workspace/db";

const router: IRouter = Router();

// GET /mood
router.get("/mood", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const history = await db
    .select()
    .from(moodHistoryTable)
    .where(eq(moodHistoryTable.userId, userId))
    .orderBy(moodHistoryTable.createdAt);
  res.json(history.map(h => ({
    ...h,
    createdAt: h.createdAt.toISOString()
  })));
});

// POST /mood
router.post("/mood", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { label, happy, sad, stress, fatigue, energy } = req.body as {
    label?: string;
    happy?: number;
    sad?: number;
    stress?: number;
    fatigue?: number;
    energy?: number;
  };

  const [inserted] = await db
    .insert(moodHistoryTable)
    .values({
      userId,
      label: label ?? "neutral",
      happy: happy ?? 5,
      sad: sad ?? 5,
      stress: stress ?? 5,
      fatigue: fatigue ?? 5,
      energy: energy ?? 5,
      createdAt: new Date(),
    })
    .returning();

  res.status(201).json({
    ...inserted,
    createdAt: inserted.createdAt.toISOString()
  });
});

export default router;
