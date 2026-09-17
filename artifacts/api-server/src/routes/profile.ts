import { Router, type IRouter } from "express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /profile
router.get("/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;

  let [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  // Auto-create empty profile on first access
  if (!profile) {
    [profile] = await db
      .insert(userProfilesTable)
      .values({ userId, profileCompleted: false })
      .returning();
  }

  res.json(serializeProfile(profile));
});

// PATCH /profile
router.patch("/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;
  const { displayName, gender, lastPeriodDate, cycleLength, lutealPhaseLength, productiveTimeStart, productiveTimeEnd, priorityOrder, themePreference, analyticsTheme, customThemeColors, weekendAvailable } = req.body as {
    displayName?: string;
    gender?: "female" | "male" | "other" | "prefer_not_to_say";
    lastPeriodDate?: string | null;
    cycleLength?: number;
    lutealPhaseLength?: number;
    productiveTimeStart?: string;
    productiveTimeEnd?: string;
    priorityOrder?: string[];
    themePreference?: string;
    analyticsTheme?: string;
    customThemeColors?: { colors: string[] };
    weekendAvailable?: boolean;
  };

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (displayName !== undefined) updateData.displayName = displayName;
  if (gender !== undefined) updateData.gender = gender;
  if (lastPeriodDate !== undefined) {
    if (lastPeriodDate) {
      const selectedDate = new Date(lastPeriodDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        res.status(400).json({ error: "The date of your last period must not be in the future." });
        return;
      }
    }
    updateData.lastPeriodDate = lastPeriodDate ? new Date(lastPeriodDate) : null;
    updateData.lastPeriodUpdatedAt = new Date();
  }
  if (cycleLength !== undefined) updateData.cycleLength = cycleLength;
  if (lutealPhaseLength !== undefined) updateData.lutealPhaseLength = lutealPhaseLength;
  if (productiveTimeStart !== undefined) updateData.productiveTimeStart = productiveTimeStart;
  if (productiveTimeEnd !== undefined) updateData.productiveTimeEnd = productiveTimeEnd;
  if (priorityOrder !== undefined) {
    if (!Array.isArray(priorityOrder) || priorityOrder.some((s) => typeof s !== 'string' || s.length > 50)) {
      res.status(400).json({ error: 'priorityOrder must be an array of strings (max 50 chars each)' });
      return;
    }
    updateData.priorityOrder = priorityOrder;
  }
  if (themePreference !== undefined) updateData.themePreference = themePreference;
  if (analyticsTheme !== undefined) updateData.analyticsTheme = analyticsTheme;
  if (customThemeColors !== undefined) updateData.customThemeColors = customThemeColors;
  if (weekendAvailable !== undefined) updateData.weekendAvailable = weekendAvailable;

  // Mark profile as completed if gender is being set
  if (gender !== undefined) {
    updateData.profileCompleted = true;
  }

  // Upsert profile
  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  let profile;
  if (!existing) {
    [profile] = await db
      .insert(userProfilesTable)
      .values({ userId, ...updateData })
      .returning();
  } else {
    [profile] = await db
      .update(userProfilesTable)
      .set(updateData)
      .where(eq(userProfilesTable.userId, userId))
      .returning();
  }

  res.json(serializeProfile(profile));
});

// GET /cycle — compute current cycle phase
router.get("/cycle", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  // Only applies to female users with period data
  if (!profile || profile.gender !== "female" || !profile.lastPeriodDate) {
    res.json({
      hasData: false,
      phase: "unknown",
      dayInCycle: null,
      efficiency: 100,
      phaseLabel: "Unknown",
      phaseDescription: "Set up your profile to enable cycle-aware scheduling.",
      shouldReschedule: false,
      needsPeriodUpdate: false,
    });
    return;
  }

  const cycleLength = profile.cycleLength ?? 28;
  const lutealPhaseLength = profile.lutealPhaseLength ?? 14;
  const lastPeriod = new Date(profile.lastPeriodDate);
  const now = new Date();

  const daysSinceLastPeriod = Math.floor(
    (now.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dayInCycle = (daysSinceLastPeriod % cycleLength) + 1;

  // Check if period update is needed (more than one cycle has passed without update)
  const needsPeriodUpdate =
    profile.lastPeriodUpdatedAt
      ? (now.getTime() - new Date(profile.lastPeriodUpdatedAt).getTime()) >
        cycleLength * 24 * 60 * 60 * 1000
      : daysSinceLastPeriod > cycleLength;

  // Phase thresholds (based on standard 28-day cycle, scaled)
  const menstrualEnd = 5;
  const follicularEnd = cycleLength - lutealPhaseLength - 1;
  const ovulatoryDay = cycleLength - lutealPhaseLength;
  // luteal: ovulatoryDay+1 to cycleLength

  type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal";
  let phase: Phase;
  let efficiency: number;
  let phaseLabel: string;
  let phaseDescription: string;

  if (dayInCycle <= menstrualEnd) {
    phase = "menstrual";
    efficiency = 40;
    phaseLabel = "Menstrual Phase";
    phaseDescription = "menstrual - ask for rest";
  } else if (dayInCycle <= follicularEnd) {
    phase = "follicular";
    efficiency = 80;
    phaseLabel = "Follicular Phase";
    phaseDescription = "follicular - full of energy so ask for completeting pending tasks";
  } else if (dayInCycle === ovulatoryDay) {
    phase = "ovulatory";
    efficiency = 100;
    phaseLabel = "Ovulation Phase";
    phaseDescription = "ovulation - ask to complete incomplete tasks espically social like call or meet";
  } else {
    phase = "luteal";
    efficiency = 60;
    phaseLabel = "Luteal Phase";
    phaseDescription = "luteal - ask to reschedule task and avoid burnout";
  }

  const shouldReschedule = phase === "luteal" || phase === "menstrual";

  res.json({
    hasData: true,
    phase,
    dayInCycle,
    efficiency,
    phaseLabel,
    phaseDescription,
    shouldReschedule,
    needsPeriodUpdate,
  });
});

function serializeProfile(p: typeof userProfilesTable.$inferSelect) {
  return {
    userId: p.userId,
    displayName: p.displayName ?? null,
    gender: p.gender ?? null,
    lastPeriodDate: p.lastPeriodDate ? p.lastPeriodDate.toISOString() : null,
    cycleLength: p.cycleLength,
    lutealPhaseLength: p.lutealPhaseLength,
    lastPeriodUpdatedAt: p.lastPeriodUpdatedAt
      ? p.lastPeriodUpdatedAt.toISOString()
      : null,
    profileCompleted: p.profileCompleted,
    weekendAvailable: p.weekendAvailable,
    productiveTimeStart: p.productiveTimeStart ?? null,
    productiveTimeEnd: p.productiveTimeEnd ?? null,
    priorityOrder: p.priorityOrder ?? null,
    themePreference: p.themePreference ?? null,
    analyticsTheme: p.analyticsTheme ?? null,
    customThemeColors: p.customThemeColors ?? null,
  };
}

export default router;
