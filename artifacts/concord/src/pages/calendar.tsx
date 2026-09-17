import { useState, useMemo } from "react";
import { useGetTasks, useUpdateTaskStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/contexts/profile-context";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Circle, CheckCircle2, RefreshCw, Calendar, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 border-rose-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-600",
  completed: "text-emerald-600 line-through",
};

export function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const queryClient = useQueryClient();


  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear + i);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const { data: rawTasks } = useGetTasks({});
  const rawApiTasks: any[] = Array.isArray(rawTasks)
    ? rawTasks
    : Array.isArray((rawTasks as any)?.tasks)
    ? (rawTasks as any).tasks
    : [];

  const tasks: any[] = rawApiTasks;

  const updateStatus = useUpdateTaskStatus({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
    },
  });

  // Calendar grid days
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Index tasks by date (supports deadline or scheduledDate)
  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      const dateStr = task.deadline || task.scheduledDate;
      if (!dateStr) continue;
      let key = "";
      try {
        if (dateStr.includes("T")) {
          key = format(parseISO(dateStr), "yyyy-MM-dd");
        } else {
          key = dateStr.slice(0, 10);
        }
      } catch {
        key = dateStr.slice(0, 10);
      }
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  // Tasks for selected day, sorted by deadline time
  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    const dayTasks = tasksByDate[key] ?? [];
    return [...dayTasks].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [selectedDay, tasksByDate]);

  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();

  const getIsWeekendHoliday = (date: Date): boolean => {
    const day = date.getDay();
    if (day === 0) return true; // Sunday
    if (day === 6) {
      const dayOfMonth = date.getDate();
      const weekIndex = Math.floor((dayOfMonth - 1) / 7) + 1;
      return weekIndex === 2 || weekIndex === 4; // 2nd or 4th Saturday
    }
    return false;
  };

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const cycleStatus = (task: (typeof tasks)[0]) => {
    const taskDate = task.deadline || task.scheduledDate;
    if (taskDate) {
      const parsedDate = new Date(taskDate);
      if (getIsWeekendHoliday(parsedDate) && !profile?.weekendAvailable) {
        toast({
          title: "Weekend Holiday 🛑",
          description: "Weekend availability is turned off. You cannot perform tasks on holidays!",
          variant: "destructive"
        });
        return;
      }
    }
    const next =
      task.status === "pending"
        ? "in_progress"
        : task.status === "in_progress"
        ? "completed"
        : "pending";
    updateStatus.mutate({ id: task.id, data: { status: next } });
  };

  const handleSetWeekendAvailability = async (available: boolean) => {
    try {
      await updateProfile({ weekendAvailable: available });
      toast({
        title: available ? "Weekend Work Enabled 👍" : "Weekend Holiday Maintained 🏡",
        description: available ? "You can now perform and schedule tasks on weekend holidays." : "Weekend tasks are locked.",
      });
    } catch {
      toast({ title: "Failed to update availability", variant: "destructive" });
    }
  };

  const handleDeleteAllForDay = async () => {
    if (!selectedDay) return;
    const dateStr = format(selectedDay, "yyyy-MM-dd");
    if (
      window.confirm(
        `Are you sure you want to delete all tasks scheduled on ${format(
          selectedDay,
          "MMMM d, yyyy"
        )}?`
      )
    ) {
      try {
        // Delete database tasks by calling task delete mutation or endpoint for each task
        for (const task of selectedDayTasks) {
          if (task.id) {
            await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
          }
        }

        toast({
          title: "Tasks Deleted 🗑️",
          description: `All tasks for ${format(selectedDay, "MMMM d, yyyy")} have been deleted.`,
        });

        // Invalidate queries to refresh task list
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to delete tasks.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-medium tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">
          View tasks by date — click any day to see its schedule.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* ── Calendar Grid ─────────────────────────── */}
        <div className="md:col-span-3 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          {/* Month header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Select
                value={format(currentMonth, "MMMM")}
                onValueChange={(val) => {
                  const mIdx = months.indexOf(val);
                  const nextMonth = new Date(currentMonth);
                  nextMonth.setMonth(mIdx);
                  const maxDate = new Date();
                  maxDate.setFullYear(maxDate.getFullYear() + 10);
                  if (nextMonth <= maxDate) {
                    setCurrentMonth(nextMonth);
                  }
                }}
              >
                <SelectTrigger className="w-[125px] h-9 text-xs bg-background">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={format(currentMonth, "yyyy")}
                onValueChange={(val) => {
                  const nextMonth = new Date(currentMonth);
                  nextMonth.setFullYear(Number(val));
                  const maxDate = new Date();
                  maxDate.setFullYear(maxDate.getFullYear() + 10);
                  if (nextMonth <= maxDate) {
                    setCurrentMonth(nextMonth);
                  }
                }}
              >
                <SelectTrigger className="w-[85px] h-9 text-xs bg-background">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                onClick={() => {
                  const prevMonth = subMonths(currentMonth, 1);
                  setCurrentMonth(prevMonth);
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                onClick={() => setCurrentMonth(new Date())}
              >
                <span className="text-xs font-medium">Today</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full"
                onClick={() => {
                  const nextMonth = addMonths(currentMonth, 1);
                  const maxDate = new Date();
                  maxDate.setFullYear(maxDate.getFullYear() + 10);
                  if (nextMonth <= maxDate) {
                    setCurrentMonth(nextMonth);
                  }
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 px-2 pb-4 gap-0.5">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDate[key] ?? [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const todayDay = isToday(day);

              // Show up to 3 priority dots
              const dots = dayTasks.slice(0, 3);

              const isHoliday = getIsWeekendHoliday(day);

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDay(day);
                  }}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-all duration-150 min-h-[52px]",
                    isCurrentMonth ? "hover:bg-muted/60" : "opacity-30",
                    isHoliday && isCurrentMonth && "bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200/20",
                    isSelected && "bg-primary/10 ring-1 ring-primary/40",
                    todayDay && !isSelected && "bg-primary/5",
                  )}
                >
                  {isHoliday && isCurrentMonth && (
                    <span className="absolute top-1 right-1.5 text-[8px] font-extrabold text-rose-500 leading-none">H</span>
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                      todayDay && "bg-primary text-primary-foreground font-bold",
                      isSelected && !todayDay && "text-primary font-semibold",
                      isHoliday && !todayDay && !isSelected && "text-rose-500 font-semibold",
                      !todayDay && !isSelected && !isHoliday && "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Task dots */}
                  <div className="flex gap-0.5 flex-wrap justify-center h-3">
                    {dots.map((t: any, i: number) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          PRIORITY_DOT[t.priority] ?? "bg-muted-foreground",
                          t.status === "completed" && "opacity-40",
                        )}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] text-muted-foreground leading-none">+{dayTasks.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 px-6 py-3 border-t border-border/50">
            {Object.entries(PRIORITY_DOT).map(([p, cls]) => (
              <div key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={cn("w-2 h-2 rounded-full", cls)} />
                <span className="capitalize">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Day Detail Panel ──────────────────────── */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              {selectedDay ? (
                <motion.div
                  key={format(selectedDay, "yyyy-MM-dd")}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col h-full"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold font-serif">
                        {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE")}
                      </h3>
                      <p className="text-muted-foreground text-sm">{format(selectedDay, "MMMM d, yyyy")}</p>
                    </div>
                    {selectedDayTasks.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteAllForDay}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 h-8 gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete All
                      </Button>
                    )}
                  </div>

                  {getIsWeekendHoliday(selectedDay) && !profile?.weekendAvailable && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 mb-4 space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-rose-900">Weekend Holiday 🏡</span>
                          <span className="text-xs text-rose-700">
                            This day is a weekend holiday (2nd/4th Saturday or Sunday). Are you available to work?
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-rose-200 text-rose-700 hover:bg-rose-100/50"
                          onClick={() => handleSetWeekendAvailability(false)}
                        >
                          No, keep holiday
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 bg-rose-600 text-white hover:bg-rose-700"
                          onClick={() => handleSetWeekendAvailability(true)}
                        >
                          Yes, I am available
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedDayTasks.length === 0 ? (
                    <div className="flex-1 bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3 min-h-[250px]">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <Circle className="w-5 h-5 opacity-40" />
                      </div>
                      <div>
                        <p className="font-medium">No tasks scheduled</p>
                        <p className="text-sm mt-1">Add a task with this date as deadline to see it here.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex-1">
                      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                        <span className="text-sm font-medium">{selectedDayTasks.length} task{selectedDayTasks.length > 1 ? "s" : ""}</span>
                        <div className="flex gap-1">
                          {["high", "medium", "low"].map((p) => {
                            const cnt = selectedDayTasks.filter((t) => t.priority === p).length;
                            if (!cnt) return null;
                            return (
                              <span key={p} className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", PRIORITY_BADGE[p])}>
                                {cnt} {p}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <ScrollArea className="max-h-[460px]">
                        <div className="relative px-5 py-4">
                          {/* Timeline line */}
                          <div className="absolute left-[2.15rem] top-4 bottom-4 w-px bg-border/50" />

                          <div className="space-y-4">
                            {selectedDayTasks.map((task) => {
                              const time = task.deadline
                                ? format(parseISO(task.deadline), "h:mm a")
                                : null;
                              return (
                                <div key={task.id} className="flex gap-4 relative">
                                  {/* Timeline dot */}
                                  <button
                                    onClick={() => cycleStatus(task)}
                                    className={cn(
                                      "shrink-0 w-5 h-5 rounded-full border-2 mt-1 z-10 transition-all",
                                      task.status === "completed"
                                        ? "bg-emerald-500 border-emerald-500"
                                        : task.status === "in_progress"
                                        ? "bg-blue-500 border-blue-500"
                                        : "bg-background border-border hover:border-primary",
                                    )}
                                  >
                                    {task.status === "completed" && (
                                      <CheckCircle2 className="w-full h-full text-white" />
                                    )}
                                  </button>

                                  <div className={cn(
                                    "flex-1 bg-muted/30 rounded-xl p-3 border border-border/40 transition-opacity",
                                    task.status === "completed" && "opacity-60",
                                  )}>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={cn("text-sm font-medium leading-snug", STATUS_COLORS[task.status])}>
                                        {task.title}
                                      </p>
                                      <span className={cn(
                                        "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                                        PRIORITY_BADGE[task.priority],
                                      )}>
                                        {task.priority}
                                      </span>
                                    </div>
                                    {time && (
                                      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        <span>{time}</span>
                                      </div>
                                    )}
                                    {task.category && (
                                      <span className="mt-1 inline-block text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md capitalize">
                                        {task.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 bg-card border border-border/50 rounded-2xl shadow-sm flex items-center justify-center text-muted-foreground text-center p-8 min-h-[250px]"
                >
                  <div>
                    <p className="font-medium">Select a day</p>
                    <p className="text-sm mt-1">Click any date to see tasks for that day.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


        </div>
      </div>
    </div>
  );
}
