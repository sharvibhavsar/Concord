import { useCycle } from "@/contexts/cycle-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { Activity, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const PHASE_COLORS: Record<string, string> = {
  menstrual: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800/50 dark:text-rose-300",
  follicular: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300",
  ovulatory: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-300",
  luteal: "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-950/30 dark:border-violet-800/50 dark:text-violet-300",
  unknown: "bg-muted/50 border-border text-muted-foreground",
};

const EFFICIENCY_COLOR: Record<string, string> = {
  menstrual: "bg-rose-200 dark:bg-rose-800",
  follicular: "bg-emerald-200 dark:bg-emerald-800",
  ovulatory: "bg-amber-200 dark:bg-amber-800",
  luteal: "bg-violet-200 dark:bg-violet-800",
  unknown: "bg-muted",
};

export function PhaseBanner() {
  const { cycleInfo, isLoading } = useCycle();
  const { profile } = useProfile();

  // Only show for female users with data
  if (isLoading || !cycleInfo || !cycleInfo.hasData || profile?.gender !== "female") {
    return null;
  }

  const phase = cycleInfo.phase;
  const colorClass = PHASE_COLORS[phase] ?? PHASE_COLORS.unknown;
  const efficiencyColor = EFFICIENCY_COLOR[phase] ?? EFFICIENCY_COLOR.unknown;

  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-4 transition-colors", colorClass)}>
      <div className="w-10 h-10 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center shrink-0">
        <Activity className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{cycleInfo.phaseLabel}</span>
          {cycleInfo.dayInCycle !== null && (
            <span className="text-xs opacity-70">Day {cycleInfo.dayInCycle}</span>
          )}
        </div>
        <p className="text-xs opacity-80 leading-relaxed line-clamp-2">{cycleInfo.phaseDescription}</p>
        {/* Efficiency bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", efficiencyColor)}
              style={{ width: `${cycleInfo.efficiency}%` }}
            />
          </div>
          <span className="text-xs font-medium opacity-70 shrink-0">{cycleInfo.efficiency}% energy</span>
        </div>
      </div>
      <Link href="/profile" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
