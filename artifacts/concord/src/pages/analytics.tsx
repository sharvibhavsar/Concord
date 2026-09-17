import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Zap, Target, Award, ShieldAlert, Activity, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
import { format, subDays, startOfDay, endOfDay, startOfWeek, subWeeks, parseISO } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────
interface AnalyticsData {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  completionRate: number;
  byPriority: { priority: string; total: number; completed: number }[];
  byCategory: { category: string; total: number; completed: number }[];
  weeklyCompletion: { week: string; completed: number; created: number }[];
  weeklyStatus: { week: string; pending: number; inProgress: number; completed: number }[];
  dailyHeatmap: { date: string; count: number }[];
  onTimeCount: number;
  lateCount: number;
  deadlinePrecision: { title: string; daysEarly: number; priority: string }[];
  categoryRadar: { category: string; completionRate: number; total: number }[];
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/analytics`, { credentials: "include" });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("fetchAnalytics failed:", e);
  }
  return null;
}

async function fetchTasks(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/tasks`, { credentials: "include" });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("fetchTasks failed:", e);
  }
  return [];
}

type AnalyticsTheme = "pink" | "warm" | "cool" | "custom";

const THEME_PALETTES: Record<AnalyticsTheme | "default", { primary: string; completed: string; inProgress: string; pending: string; overdue: string; high: string; medium: string; low: string; categories: string[] }> = {
  default: {
    primary: "#614475", completed: "#10b981", inProgress: "#3b82f6",
    pending: "#f59e0b", overdue: "#ef4444", high: "#ef4444", medium: "#f59e0b", low: "#10b981",
    categories: ["#614475","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316"],
  },
  pink: {
    primary: "#be185d", completed: "#db2777", inProgress: "#f472b6",
    pending: "#fda4af", overdue: "#9d174d", high: "#9d174d", medium: "#db2777", low: "#f472b6",
    categories: ["#be185d","#db2777","#ec4899","#f472b6","#fda4af","#fce7f3","#9d174d","#831843"],
  },
  warm: {
    primary: "#b45309", completed: "#d97706", inProgress: "#f59e0b",
    pending: "#fbbf24", overdue: "#dc2626", high: "#dc2626", medium: "#f59e0b", low: "#86efac",
    categories: ["#b45309","#d97706","#f59e0b","#fbbf24","#fde68a","#dc2626","#ea580c","#f97316"],
  },
  cool: {
    primary: "#1d4ed8", completed: "#0891b2", inProgress: "#06b6d4",
    pending: "#67e8f9", overdue: "#7c3aed", high: "#7c3aed", medium: "#1d4ed8", low: "#0891b2",
    categories: ["#1d4ed8","#0891b2","#06b6d4","#0284c7","#7c3aed","#6d28d9","#2563eb","#0e7490"],
  },
  custom: {
    primary: "#6366f1", completed: "#22c55e", inProgress: "#3b82f6",
    pending: "#f59e0b", overdue: "#ef4444", high: "#ef4444", medium: "#f59e0b", low: "#22c55e",
    categories: ["#6366f1","#22c55e","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316"],
  },
};

function HeatmapGrid({ data, color = "#10b981" }: { data: { date: string; count: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const weeks: { date: string; count: number }[][] = [];
  let week: { date: string; count: number }[] = [];
  for (const d of data) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {weeks.map((w, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {w.map((d) => {
            const pct = d.count === 0 ? 0 : d.count / Math.max(max, 1);
            const opacity = pct === 0 ? 0 : pct < 0.25 ? 0.3 : pct < 0.5 ? 0.5 : pct < 0.75 ? 0.7 : 1.0;
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.count} task${d.count !== 1 ? "s" : ""} completed`}
                className="w-3 h-3 rounded-sm transition-colors"
                style={d.count === 0
                  ? { backgroundColor: "rgba(100, 100, 100, 0.1)" }
                  : { backgroundColor: color, opacity }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border/50 rounded-2xl shadow-sm p-5", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border/60 rounded-xl shadow-md px-4 py-3 text-sm">
      {label && <p className="font-medium text-foreground mb-2">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}: <strong className="text-foreground">{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const [activeTheme, setActiveTheme] = useState<AnalyticsTheme>("cool");
  const [customColors, setCustomColors] = useState<string[]>(["#6366f1","#22c55e","#f59e0b","#3b82f6","#ef4444","#ec4899"]);
  const { profile } = useProfile();

  // Load API tasks + local tasks to compute accurate live charts
  const { data: rawTasks, isLoading: isTasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    queryFn: fetchTasks,
    refetchOnWindowFocus: false,
  });

  const { data: apiData, isLoading: isApiDataLoading } = useQuery<AnalyticsData | null>({
    queryKey: ["/api/analytics"],
    queryFn: fetchAnalytics,
    refetchOnWindowFocus: false,
  });

  const recomputedData = useMemo(() => {
    const all = Array.isArray(rawTasks) ? rawTasks : [];
    const now = new Date();

    // ── Calculations ──
    const total = all.length;
    const completed = all.filter((t) => t.status === "completed").length;
    const inProgress = all.filter((t) => t.status === "in_progress").length;
    const pending = all.filter((t) => t.status === "pending").length;
    const overdue = all.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed"
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Priorities
    const priorities = ["high", "medium", "low"] as const;
    const byPriority = priorities.map((p) => {
      const tasksWithPriority = all.filter((t) => t.priority === p);
      return {
        priority: p,
        total: tasksWithPriority.length,
        completed: tasksWithPriority.filter((t) => t.status === "completed").length,
      };
    });

    // Categories — normalize to lowercase key to avoid "work"/"Work" duplicates
    const catMap: Record<string, { total: number; completed: number; displayName: string }> = {};
    for (const task of all) {
      const raw = task.category ?? "General";
      const key = raw.trim().toLowerCase();
      const display = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
      if (!catMap[key]) catMap[key] = { total: 0, completed: 0, displayName: display };
      catMap[key].total++;
      if (task.status === "completed") catMap[key].completed++;
    }
    const byCategory = Object.entries(catMap)
      .map(([_key, v]) => ({ category: v.displayName, total: v.total, completed: v.completed }))
      .sort((a, b) => b.total - a.total);

    // Weekly completion
    const weeklyCompletion: { week: string; completed: number; created: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekLabel = format(weekStart, "MMM d");

      const completedInWeek = all.filter((t) => {
        if (t.status !== "completed") return false;
        const dateToCheck = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
        return dateToCheck >= weekStart && dateToCheck <= weekEnd;
      }).length;

      const createdInWeek = all.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= weekStart && created <= weekEnd;
      }).length;

      weeklyCompletion.push({ week: weekLabel, completed: completedInWeek, created: createdInWeek });
    }

    // Daily Heatmap
    const dailyHeatmap: { date: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const count = all.filter((t) => {
        if (t.status !== "completed") return false;
        const dateToCheck = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
        return dateToCheck >= dayStart && dateToCheck <= dayEnd;
      }).length;
      dailyHeatmap.push({ date: format(day, "yyyy-MM-dd"), count });
    }

    // Deadline precision
    const deadlinePrecision: { title: string; daysEarly: number; priority: string }[] = [];
    let onTimeCount = 0;
    let lateCount = 0;

    for (const task of all) {
      if (task.status === "completed" && task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const completedDate = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt);
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

    // Weekly Status distribution
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

    const categoryRadar = byCategory.map((c) => ({
      category: c.category, // already normalized + capitalized
      completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
      total: c.total,
    }));

    return {
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
      rawTasks: all,
    };
  }, [rawTasks]);

  // Stage 7: Cycle Analytics Recomputation
  const { cyclePhaseData, hasCycleData, menstrualRestCount, lutealRestCount } = useMemo(() => {
    // Women Menstrual Cycle vs Productivity
    const hasCycleData = !!(profile?.gender === "female" && profile?.lastPeriodDate);
    const cyclePhaseData: { phase: string; completed: number; total: number; completionRate: number }[] = [];
    let menstrualRestCount = 0;
    let lutealRestCount = 0;

    if (hasCycleData && profile?.lastPeriodDate && recomputedData?.rawTasks) {
      const cycleLength = profile.cycleLength || 28;
      const lutealPhaseLength = profile.lutealPhaseLength || 14;
      const lastPeriod = new Date(profile.lastPeriodDate);

      const phasesMap: Record<string, { completed: number; total: number }> = {
        Menstrual: { completed: 0, total: 0 },
        Follicular: { completed: 0, total: 0 },
        Ovulatory: { completed: 0, total: 0 },
        Luteal: { completed: 0, total: 0 },
      };

      const menstrualEnd = 5;
      const follicularEnd = cycleLength - lutealPhaseLength - 1;
      const ovulatoryDay = cycleLength - lutealPhaseLength;

      for (const t of recomputedData.rawTasks) {
        const taskDate = new Date(t.createdAt);
        const daysSinceLastPeriod = Math.floor(
          (taskDate.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24)
        );
        const dayInCycle = (daysSinceLastPeriod % cycleLength) + 1;

        let phase = "Luteal";
        if (dayInCycle <= menstrualEnd) phase = "Menstrual";
        else if (dayInCycle <= follicularEnd) phase = "Follicular";
        else if (dayInCycle === ovulatoryDay) phase = "Ovulatory";

        phasesMap[phase].total++;
        if (t.status === "completed") {
          phasesMap[phase].completed++;
          // Count completed tasks containing "rest" (case-insensitive) during Menstrual or Luteal phases
          if (t.title.toLowerCase().includes("rest")) {
            if (phase === "Menstrual") {
              menstrualRestCount++;
            } else if (phase === "Luteal") {
              lutealRestCount++;
            }
          }
        }
      }

      for (const [phase, val] of Object.entries(phasesMap)) {
        cyclePhaseData.push({
          phase,
          completed: val.completed,
          total: val.total,
          completionRate: val.total > 0 ? Math.round((val.completed / val.total) * 100) : 0,
        });
      }
    }

    return { cyclePhaseData, hasCycleData, menstrualRestCount, lutealRestCount };
  }, [profile, recomputedData]);

  if (isTasksLoading && !recomputedData) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-medium tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Analysing your task performance...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const data = recomputedData;

  const effectivePalette = activeTheme === "custom"
    ? { ...THEME_PALETTES.custom, categories: customColors }
    : THEME_PALETTES[activeTheme];

  const statusDonut = [
    { name: "Completed", value: data.completed, color: effectivePalette.completed },
    { name: "In Progress", value: data.inProgress, color: effectivePalette.inProgress },
    { name: "Pending", value: data.pending, color: effectivePalette.pending },
    { name: "Overdue", value: data.overdue, color: effectivePalette.overdue },
  ].filter((d) => d.value > 0);

  const deadlineDonut = [
    { name: "On Time", value: data.onTimeCount, color: effectivePalette.completed },
    { name: "Late", value: data.lateCount, color: effectivePalette.overdue },
  ].filter((d) => d.value > 0);

  const priorityBar = data.byPriority.map((p) => ({
    name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
    Total: p.total,
    Completed: p.completed,
    Pending: p.total - p.completed,
    fill: effectivePalette[p.priority as keyof typeof effectivePalette] as string || effectivePalette.primary,
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-medium tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Trends, patterns, and performance insights from your tasks.</p>
      </div>

      {/* Theme selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Chart theme:</span>
        {(["pink", "warm", "cool", "custom"] as AnalyticsTheme[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTheme(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${activeTheme === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {t === "pink" ? "🌸 Pink" : t === "warm" ? "🔥 Warm" : t === "cool" ? "❄️ Cool" : "🎨 Custom"}
          </button>
        ))}
      </div>

      {/* Custom color panel */}
      {activeTheme === "custom" && (
        <div className="mb-6 p-5 bg-card border border-border/50 rounded-2xl">
          <h3 className="text-sm font-semibold mb-4">Custom Color Palette</h3>
          <p className="text-xs text-muted-foreground mb-4">Select 6 colors for your custom theme.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {customColors.map((color, idx) => (
              <div key={idx} className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Color {idx + 1}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const next = [...customColors];
                      next[idx] = e.target.value;
                      setCustomColors(next);
                    }}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border p-0.5"
                  />
                  <input
                    type="text"
                    value={color.toUpperCase()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                        const next = [...customColors];
                        next[idx] = v;
                        setCustomColors(next);
                      }
                    }}
                    className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CheckCircle2} label="Completion Rate" value={`${data.completionRate}%`}
          sub={`${data.completed} of ${data.total} tasks`} color="bg-emerald-100 text-emerald-700" />
        <StatCard icon={AlertCircle} label="Overdue" value={data.overdue}
          sub={data.overdue === 0 ? "All clear!" : "Needs attention"} color="bg-rose-100 text-rose-700" />
        <StatCard icon={Target} label="On-time Rate" value={
          data.onTimeCount + data.lateCount > 0
            ? `${Math.round((data.onTimeCount / (data.onTimeCount + data.lateCount)) * 100)}%`
            : "—"
        } sub={`${data.onTimeCount} on time · ${data.lateCount} late`} color="bg-blue-100 text-blue-700" />
        <StatCard icon={Zap} label="Active Tasks" value={data.inProgress}
          sub={`${data.pending} pending`} color="bg-amber-100 text-amber-700" />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="heatmap">Activity Map</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          {profile?.gender === "female" && (
            <TabsTrigger value="cycle">🧘 Cycle Productivity</TabsTrigger>
          )}
        </TabsList>

        {/* ── OVERVIEW ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <ChartCard title="Task Status Distribution">
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={statusDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                      paddingAngle={3} dataKey="value">
                      {statusDonut.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusDonut.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Tasks by Priority">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={priorityBar} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Completed" fill={effectivePalette.completed} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pending" fill="rgba(100, 100, 100, 0.15)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tasks by Category">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={data.byCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                      paddingAngle={2} dataKey="total" nameKey="category">
                      {data.byCategory.map((_, i) => (
                        <Cell key={i} fill={effectivePalette.categories[i % effectivePalette.categories.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1 overflow-hidden">
                  {data.byCategory.slice(0, 7).map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: effectivePalette.categories[i % effectivePalette.categories.length] }} />
                      <span className="text-muted-foreground capitalize truncate">{c.category}</span>
                      <span className="font-medium ml-auto">{c.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Deadline Accuracy">
              {data.onTimeCount + data.lateCount === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  Complete tasks with deadlines to see accuracy.
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={deadlineDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                        paddingAngle={4} dataKey="value">
                        {deadlineDonut.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {deadlineDonut.map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-semibold ml-2">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        {/* ── TRENDS ──────────────────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-4">
          <ChartCard title="Weekly Activity — Tasks Created vs Completed (Last 8 Weeks)">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.weeklyCompletion} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={effectivePalette.completed} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={effectivePalette.completed} stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={effectivePalette.primary} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={effectivePalette.primary} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Area name="Tasks Completed" type="monotone" dataKey="completed" stroke={effectivePalette.completed} fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                <Area name="Tasks Created" type="monotone" dataKey="created" stroke={effectivePalette.primary} fillOpacity={1} fill="url(#colorCreated)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        {/* ── HEATMAP ─────────────────────────────────────────────────── */}
        <TabsContent value="heatmap" className="space-y-4">
          <ChartCard title="Task Completion Heatmap (Last 90 Days)">
            <div className="py-2">
              <HeatmapGrid data={data.dailyHeatmap} color={effectivePalette.completed} />
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 border-t border-border/40 pt-3">
                <span>90 days ago</span>
                <div className="flex items-center gap-1.5">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(100, 100, 100, 0.1)" }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: effectivePalette.completed, opacity: 0.3 }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: effectivePalette.completed, opacity: 0.6 }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: effectivePalette.completed }} />
                  <span>More</span>
                </div>
                <span>Today</span>
              </div>
            </div>
          </ChartCard>
        </TabsContent>

        {/* ── PERFORMANCE ─────────────────────────────────────────────── */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <ChartCard title="Category Completion Rate (Radar)">
              {data.categoryRadar.length < 3 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm text-center">
                  Add tasks across at least 3 categories to see the radar chart.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.categoryRadar}>
                      <PolarGrid stroke="var(--border)" strokeOpacity={0.6} />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickLine={false}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fontSize: 9 }}
                        tickCount={5}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Radar
                        name="Completion %"
                        dataKey="completionRate"
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.55}
                        strokeWidth={3}
                        dot={{ r: 5, fill: "#4f46e5", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 7, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
                      />
                      <Tooltip
                        formatter={(value: number, _name: string, props: any) => [
                          `${value}% (${props.payload?.total ?? 0} tasks)`,
                          "Completion Rate",
                        ]}
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  {/* Per-category breakdown below radar */}
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                    {data.categoryRadar.map((c, i) => (
                      <div key={c.category} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: effectivePalette.categories[i % effectivePalette.categories.length] }}
                        />
                        <span className="text-muted-foreground capitalize truncate">{c.category}</span>
                        <span className="font-semibold ml-auto">{c.completionRate}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            <ChartCard title="Missed Deadlines by Priority">
              {data.deadlinePrecision.filter((d) => d.daysEarly < 0).length === 0 ? (
                <div className="flex items-center justify-center h-48 text-emerald-600 gap-3">
                  <Award className="w-6 h-6" />
                  <span className="font-semibold">No missed deadlines! Excellent. 🎉</span>
                </div>
              ) : (
                <div className="overflow-x-auto h-48">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                        <th className="pb-2 font-semibold">Task</th>
                        <th className="pb-2 font-semibold text-right">Days Late</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deadlinePrecision
                        .filter((d) => d.daysEarly < 0)
                        .sort((a, b) => a.daysEarly - b.daysEarly)
                        .map((d, i) => (
                          <tr key={i} className="border-b border-border/30 last:border-0">
                            <td className="py-2 text-foreground font-medium">{d.title}</td>
                            <td className="py-2 text-right text-rose-600 font-semibold">{Math.abs(d.daysEarly)}d</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        {/* ── CYCLE PRODUCTIVITY ─────────────────────────── */}
        {profile?.gender === "female" && (
          <TabsContent value="cycle" className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {hasCycleData ? (
                <>
                  <ChartCard title="Productivity Rate by Menstrual Cycle Phase">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={cyclePhaseData} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="phase" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value) => [`${value}%`, "Completion Rate"]} />
                        <Bar dataKey="completionRate" fill="#db2777" radius={[6, 6, 0, 0]}>
                          {cyclePhaseData.map((entry, index) => {
                            const colors = ["#ef4444", "#3b82f6", "#10b981", "#8b5cf6"];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Rest Task Indicator - Menstrual & Luteal Wellness tracker */}
                  <Card className="border-border bg-gradient-to-r from-rose-500/5 via-purple-500/5 to-pink-500/5 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm rounded-2xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                        <Heart className={cn("w-6 h-6", (menstrualRestCount > 0 || lutealRestCount > 0) && "animate-pulse")} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-sm text-rose-800 dark:text-rose-300">Menstrual & Luteal Wellness Rest Tracker</h4>
                        <p className="text-xs text-muted-foreground leading-normal max-w-xl">
                          Taking rest during the Menstrual and Luteal phases is a positive wellness sign of cycle energy balancing. 
                          We track any completed tasks containing "rest" in their name during these phases.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center p-3 rounded-xl bg-background border border-rose-200/40 min-w-[110px]">
                        <span className="block text-2xl font-bold text-rose-600">{menstrualRestCount}</span>
                        <span className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wide">
                          Menstrual Rest
                        </span>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-background border border-purple-200/40 min-w-[110px]">
                        <span className="block text-2xl font-bold text-purple-600">{lutealRestCount}</span>
                        <span className="text-[9px] uppercase font-semibold text-muted-foreground tracking-wide">
                          Luteal Rest
                        </span>
                      </div>
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="border-border bg-muted/20 p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <Heart className="w-8 h-8 text-rose-500 animate-pulse" />
                  <h4 className="font-semibold text-sm">Menstrual Cycle Analytics Offline</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    To view your cycle-aware productivity analytics, please configure cycle tracking in your profile settings.
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
