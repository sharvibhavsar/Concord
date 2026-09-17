import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCycle } from "@/contexts/cycle-context";
import { useProfile } from "@/contexts/profile-context";
import { useGetTasks, getGetTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "concord_reschedule_dismissed";

function getDismissedKey(phase: string) {
  const today = new Date().toDateString();
  return `${STORAGE_KEY}_${phase}_${today}`;
}

export function RescheduleDialog() {
  const { cycleInfo } = useCycle();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [rescheduled, setRescheduled] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const { data: rawTasks } = useGetTasks(
    { priority: "low", status: "pending" },
    { query: { queryKey: getGetTasksQueryKey({ priority: "low", status: "pending" }), enabled: !!cycleInfo?.shouldReschedule && profile?.gender === "female" } },
  );

  const lowPriorityTasks: any[] = Array.isArray(rawTasks)
    ? rawTasks
    : Array.isArray((rawTasks as any)?.tasks)
    ? (rawTasks as any).tasks
    : [];

  useEffect(() => {
    if (
      cycleInfo?.shouldReschedule &&
      profile?.gender === "female" &&
      lowPriorityTasks.length > 0
    ) {
      const key = getDismissedKey(cycleInfo.phase);
      const dismissed = sessionStorage.getItem(key);
      if (!dismissed) {
        setOpen(true);
      }
    }
  }, [cycleInfo?.shouldReschedule, cycleInfo?.phase, profile?.gender, lowPriorityTasks.length]);

  async function handleReschedule(taskId: number) {
    // Push deadline out by 7 days (or remove deadline and mark as low priority confirmed)
    try {
      const task = lowPriorityTasks.find((t: any) => t.id === taskId);
      const newDeadline = task?.deadline
        ? new Date(new Date(task.deadline).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: newDeadline }),
      });

      setRescheduled((prev) => new Set([...prev, taskId]));
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch {
      // silent
    }
  }

  function handleClose() {
    if (cycleInfo?.phase) {
      sessionStorage.setItem(getDismissedKey(cycleInfo.phase), "true");
    }
    setOpen(false);
  }

  if (!cycleInfo?.shouldReschedule || !profile || profile.gender !== "female") return null;

  const phaseName = cycleInfo.phase === "menstrual" ? "menstrual" : "luteal";
  const phaseColor = cycleInfo.phase === "menstrual" ? "text-rose-500" : "text-violet-500";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lighten your load</DialogTitle>
          <DialogDescription>
            You're in your <span className={cn("font-medium", phaseColor)}>{phaseName} phase</span>.
            {" "}These low-priority tasks can be rescheduled to give you space to focus on what's essential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {lowPriorityTasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No low-priority pending tasks found.</p>
            </div>
          ) : (
            lowPriorityTasks.map((task: any) => {
              const done = rescheduled.has(task.id);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl border transition-all",
                    done ? "opacity-50 bg-muted/30" : "bg-background border-border/60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {task.category ?? "general"}
                      </Badge>
                      {task.deadline && (
                        <span className="text-[10px] text-muted-foreground">
                          due {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={done ? "ghost" : "outline"}
                    className="shrink-0 h-8 text-xs"
                    onClick={() => handleReschedule(task.id)}
                    disabled={done}
                  >
                    {done ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Rescheduled</>
                    ) : (
                      <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Push +7 days</>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Keep as-is
          </Button>
          <Button className="flex-1" onClick={handleClose}>
            Done <ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
