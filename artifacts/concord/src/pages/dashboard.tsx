import React, { useState, useEffect } from "react";
import { useGetTasksSummary, getGetTasksSummaryQueryKey, useUpdateTaskStatus, useGetTasks } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckCircle2, Clock, ListTodo, ArrowRight, CalendarDays, Heart, Sparkles, Activity } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";
import { format, isPast } from "date-fns";
import { motion } from "framer-motion";
import { PhaseBanner } from "@/components/phase-banner";
import { useAuth } from "@/contexts/auth-context";
import { useProfile } from "@/contexts/profile-context";
import { useCycle } from "@/contexts/cycle-context";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function Dashboard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const updateStatus = useUpdateTaskStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTasksSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      }
    }
  });

  const toggleTaskStatus = async (task: any) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    if (task.id) {
      await updateStatus.mutateAsync({ id: task.id, data: { status: nextStatus } });
    }
  };

  const { data: summaryData, isLoading } = useGetTasksSummary({
    query: { queryKey: getGetTasksSummaryQueryKey(), enabled: !!user }
  });

  const { data: moodHistory } = useQuery<any[]>({
    queryKey: ["/api/mood"],
    queryFn: () => fetch("/api/mood").then((r) => r.json()),
    enabled: !!user,
  });

  const apiDeadlines = Array.isArray(summaryData?.upcomingDeadlines) ? summaryData.upcomingDeadlines : [];
  const mergedDeadlines = apiDeadlines;

  const summary = {
    total: user ? (summaryData?.total ?? 0) : 0,
    pending: user ? (summaryData?.pending ?? 0) : 0,
    inProgress: user ? (summaryData?.inProgress ?? 0) : 0,
    completed: user ? (summaryData?.completed ?? 0) : 0,
    upcomingDeadlines: user ? mergedDeadlines : [],
    byCategory: user ? (Array.isArray(summaryData?.byCategory) ? summaryData.byCategory : []) : [],
  };

  const greeting = user ? (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 21) return "Good Evening";
    return "Good Night";
  })() : "Welcome to Concord";

  const firstName = user ? (
    profile?.displayName?.split(" ")[0] ??
    user?.firstName ??
    null
  ) : null;

  const { cycleInfo } = useCycle();
  const { toast } = useToast();
  const [currentSuggestion, setCurrentSuggestion] = useState("");
  const [addingRestTask, setAddingRestTask] = useState(false);

  // Fetch all tasks (api + local merged) to check for scheduled "Rest" task
  const { data: rawTasks } = useGetTasks({});
  const apiTasks = Array.isArray(rawTasks)
    ? rawTasks
    : Array.isArray((rawTasks as any)?.tasks)
    ? (rawTasks as any).tasks
    : [];

  const allTasks = apiTasks;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayTasks = allTasks.filter((t: any) => {
    const tDate = t.scheduledDate || (t.deadline ? t.deadline.split("T")[0] : null);
    return tDate === todayStr;
  });

  const hasRestTaskToday = todayTasks.some((t: any) => t.title.toLowerCase() === "rest");

  const CYCLE_SUGGESTIONS: Record<string, string[]> = {
    ovulatory: [
      "Bright and optimistic day! Your energy is peaking. We suggest completing overdue tasks, especially social ones like networking, calls, or meetings.",
      "High communication window! You feel highly optimistic. It's the perfect day to clear overdue tasks, especially collaborative and social meetings.",
      "Optimistic and social flow active. Reach out to friends, call partners, and knock out those pending social and communication tasks today.",
      "Your biological peak is today! Stay bright and take action: schedule calls, host team catch-ups, and complete outstanding overdue tasks."
    ],
    follicular: [
      "Follicular energy burst active! High cognitive ability. We suggest focusing on completing complex overdue tasks and planning ahead.",
      "You are full of creative stamina today. Dive into your pending tasks backlog and clear out overdue items with maximum focus.",
      "Great mental clarity and energy! It is a wonderful day to start new initiatives and conquer challenging overdue tasks.",
      "Stamina is high! Clear away outstanding overdue tasks and tackle projects that require deep concentration and planning."
    ],
    luteal: [
      "Energy is winding down. We suggest taking a step back to rest, avoiding burnout, and rescheduling low-priority tasks.",
      "Biological shift: time to slow down. Focus on detail-oriented, individual work and reschedule low-priority tasks to conserve energy.",
      "Rest and recharge. We suggest keeping your schedule light, scaling back low-priority tasks, and taking breaks to avoid burnout.",
      "Slow down and prepare for self-care. Reschedule non-urgent tasks to next week to avoid unnecessary cognitive fatigue."
    ],
    menstrual: [
      "Menstrual phase: take it easy and have some rest. Grab a warm bag and dark chocolate; your body needs time to recharge.",
      "Listen to your cramps and fatigue: rest suggestions apply today! Sip warm tea, relax with dark chocolate, and keep tasks minimal.",
      "Take it easy and recharge today. Consider placing a warm bag on your back, having dark chocolate, and scheduling a Rest task.",
      "Wellness check: self-care is a must. Relax with warm compress therapy and dark chocolate; cramps will pass soon, so rest up."
    ],
  };

  useEffect(() => {
    if (cycleInfo?.phase && CYCLE_SUGGESTIONS[cycleInfo.phase]) {
      const list = CYCLE_SUGGESTIONS[cycleInfo.phase];
      const randomIndex = Math.floor(Math.random() * list.length);
      setCurrentSuggestion(list[randomIndex]);
    }
  }, [cycleInfo?.phase, profile?.lastPeriodDate, profile?.lutealPhaseLength]);

  const handleAddRestTask = async () => {
    setAddingRestTask(true);
    try {
      const restPayload = {
        title: "Rest",
        category: "Wellness",
        priority: "high",
        status: "completed",
        duration: "60",
        scheduledDate: todayStr,
        deadline: new Date().toISOString(),
        rawInput: "Rest during menstrual phase",
        summary: "Resting during the menstrual phase is a positive sign of health balance.",
        keywords: ["rest", "cycle"],
      };

      // Add to local storage
      const newTask = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        ...restPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const local = JSON.parse(localStorage.getItem("concord_local_tasks") ?? "[]");
      local.unshift(newTask);
      localStorage.setItem("concord_local_tasks", JSON.stringify(local));

      // Call API
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restPayload),
      });

      if (res.ok) {
        toast({
          title: "Rest Task Added! 💖",
          description: "Prioritizing rest during this phase is counted as a positive wellness sign.",
        });
      } else {
        toast({
          title: "Rest Task Saved Locally",
          description: "Prioritizing rest is a positive sign.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: getGetTasksSummaryQueryKey() });
    } catch (err) {
      toast({
        title: "Rest Task Saved",
        description: "Prioritizing rest is a positive sign.",
      });
    } finally {
      setAddingRestTask(false);
    }
  };

  const pendingTodayCount = todayTasks.filter((t: any) => t.status !== "completed").length;
  const completedTodayCount = todayTasks.filter((t: any) => t.status === "completed").length;
  const totalTodayCount = todayTasks.length;

  const overdueTasks = allTasks.filter((t: any) => 
    t.deadline && new Date(t.deadline) < new Date() && t.status !== "completed"
  );

  const moodHistoryList = Array.isArray(moodHistory) ? moodHistory : [];
  const lastMood = moodHistoryList.length > 0 ? moodHistoryList[moodHistoryList.length - 1] : null;

  const smartMessage = (() => {
    if (totalTodayCount > 0 && pendingTodayCount === 0) {
      return {
        type: "success",
        text: "🎉 Excellent work! You've completed everything planned for today.",
      };
    }
    if (overdueTasks.length > 0) {
      return {
        type: "warning",
        text: `🔴 One or more tasks became overdue. Would you like to reschedule them?`,
        link: "/calendar",
      };
    }
    if (profile?.gender === "female" && cycleInfo?.hasData && cycleInfo.phase !== "unknown") {
      return {
        type: "info",
        text: `🧘 Cycle Recommendation: ${cycleInfo.phaseDescription}`,
      };
    }
    if (lastMood) {
      if (lastMood.label === "stressed" || lastMood.stress > 6) {
        return {
          type: "info",
          text: `💆 You seem a bit stressed today. Consider scheduling short breaks.`,
        };
      }
      if (lastMood.label === "tired" || lastMood.fatigue > 6) {
        return {
          type: "info",
          text: `🥱 You still have ${pendingTodayCount} task(s) today. Consider taking a short break before continuing.`,
        };
      }
      if (lastMood.label === "happy" || lastMood.happy > 6) {
        return {
          type: "success",
          text: `😊 You're doing great today! ${pendingTodayCount} task(s) remain—you've got this!`,
        };
      }
    }
    return {
      type: "default",
      text: `💡 You have ${pendingTodayCount} task(s) remaining for today. Focus on your top priority first!`,
    };
  })();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const getPhaseWorkRestSummary = (phase: string) => {
    switch (phase) {
      case "menstrual":
        return "You are currently in your Menstrual Phase. Your body is recharging — we strongly suggest prioritizing rest and keeping tasks light.";
      case "luteal":
        return "You are currently in your Luteal Phase. Your energy is winding down — we suggest rescheduling low-priority tasks to avoid burnout.";
      case "follicular":
        return "You are currently in your Follicular Phase. Stamina is high — this is a peak period to work on demanding and overdue tasks.";
      case "ovulatory":
        return "You are currently in your Ovulatory Phase. Social and optimistic energy is peaking — this is a great window for meetings and calls.";
      default:
        return "";
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">Here's your productivity overview for today.</p>
        </div>
        {user && (
          <Link href="/add">
            <Button size="lg" className="rounded-full shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:-translate-y-0.5">
              <Plus className="mr-2 w-5 h-5" />
              Add New Task
            </Button>
          </Link>
        )}
      </motion.div>

      {/* Biological Rhythm Insights Banner */}
      {user && profile?.gender === "female" && cycleInfo?.hasData && (
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-primary/10 rounded-2xl border border-pink-200/50 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 mt-0.5">
              {cycleInfo.phase === "menstrual" ? (
                <Heart className="w-6 h-6 animate-pulse" />
              ) : cycleInfo.phase === "ovulatory" ? (
                <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
              ) : (
                <Activity className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300 capitalize flex items-center gap-2">
                {cycleInfo.phase} Phase
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/30">
                  Day {cycleInfo.dayInCycle} of Cycle
                </span>
              </h3>
              <p className="text-xs font-medium text-rose-900/90 dark:text-rose-400 leading-normal max-w-xl">
                {getPhaseWorkRestSummary(cycleInfo.phase)}
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed font-serif italic pt-1 border-t border-rose-200/30 mt-1">
                "{currentSuggestion}"
              </p>
              {cycleInfo.phase === "menstrual" && (
                <p className="text-xs text-rose-600/90 font-medium pt-1">
                  💡 Menstrual Wellness: Complete your 'Rest' task to register a positive health balance sign in analytics.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
            {cycleInfo.phase === "menstrual" && (
              <Button
                size="sm"
                onClick={handleAddRestTask}
                disabled={addingRestTask || hasRestTaskToday}
                className={cn(
                  "text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm border border-transparent transition-all h-9 px-3",
                  hasRestTaskToday && "bg-rose-500/20 text-rose-500 border-rose-200/30 cursor-not-allowed hover:bg-rose-500/20"
                )}
              >
                {addingRestTask ? "Adding..." : hasRestTaskToday ? "✓ Rest Task Scheduled" : "Add 'Rest' Task"}
              </Button>
            )}
            <Link href="/tasks">
              <Button variant="outline" size="sm" className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50/50 bg-background/50 backdrop-blur-sm rounded-lg h-9">
                Reschedule Tasks
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Guest welcome banner */}
      {!user && (
        <motion.div variants={itemVariants} className="relative overflow-hidden bg-gradient-to-r from-purple-900/90 to-indigo-900/90 text-white rounded-3xl p-8 shadow-xl border border-white/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />
          <div className="relative z-10 space-y-4 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-serif font-medium tracking-tight">Organise Your Mind. Schedule Your Day.</h2>
            <p className="text-white/80 leading-relaxed text-base">
              Concord is an AI NLP-powered personal assistant and calendar that adapts to your workflow, timezone, and biological rhythms. Log in or sign up to schedule tasks, view analytics, and connect with Google Calendar.
            </p>
            <div className="flex gap-4 pt-2">
              <Link href="/login">
                <Button size="lg" className="bg-white text-indigo-900 hover:bg-white/90 rounded-full font-medium shadow-lg hover:shadow-xl transition-all">
                  Log In
                </Button>
              </Link>
              <Link href="/login?mode=signup">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 rounded-full font-medium transition-all">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Smart Context-Aware Recommendation Banner */}
      {user && smartMessage && (
        <motion.div variants={itemVariants}>
          <div className={cn(
            "rounded-2xl border p-4 flex items-center justify-between gap-4 shadow-sm",
            smartMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300" :
            smartMessage.type === "warning" ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800/40 dark:text-rose-300" :
            smartMessage.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-800/40 dark:text-blue-300" :
            "bg-muted/40 border-border text-muted-foreground"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shrink-0 shadow-sm">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium leading-relaxed">{smartMessage.text}</p>
            </div>
            {smartMessage.link && (
              <Link href={smartMessage.link}>
                <Button size="sm" variant="outline" className="text-xs shrink-0 rounded-lg">
                  Reschedule
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {/* Phase banner — only visible for female users */}
      {user && (
        <motion.div variants={itemVariants}>
          <PhaseBanner />
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/tasks">
          <SummaryCard
            title="Total Tasks"
            value={summary.total}
            icon={<ListTodo className="w-5 h-5 text-primary" />}
            trend="All recorded"
          />
        </Link>
        <Link href="/tasks?status=pending">
          <SummaryCard
            title="Pending"
            value={summary.pending}
            icon={<Clock className="w-5 h-5 text-secondary" />}
            trend="Needs attention"
          />
        </Link>
        <Link href="/tasks?status=in_progress">
          <SummaryCard
            title="In Progress"
            value={summary.inProgress}
            icon={<ArrowRight className="w-5 h-5 text-blue-500" />}
            trend="Currently working"
          />
        </Link>
        <Link href="/tasks?status=completed">
          <SummaryCard
            title="Completed"
            value={summary.completed}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            trend="Finished work"
          />
        </Link>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8">
        <motion.div variants={itemVariants}>
          <Card className="h-full border-border/50 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/30">
              <CardTitle className="text-lg font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Upcoming Tasks
                </div>
              </CardTitle>
            </CardHeader>
            
            {user && (
              <div className="flex gap-2 p-3 border-b border-border/30 bg-muted/10">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-9 text-xs bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[140px] h-9 text-xs bg-background">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[350px]">
              {(() => {
                const todayStr = format(new Date(), "yyyy-MM-dd");

                const filteredTasks = summary.upcomingDeadlines.filter((task: any) => {
                  if (filterStatus !== "all" && task.status !== filterStatus) {
                    return false;
                  }
                  if (filterPriority !== "all" && task.priority !== filterPriority) {
                    return false;
                  }
                  const taskDate = task.scheduledDate || (task.deadline ? task.deadline.split("T")[0] : null);
                  if (task && task.status === "completed") {
                    // Show completed task only if its date is today
                    return taskDate === todayStr;
                  }
                  return true;
                });

                // Sort tasks: completed go to bottom, others sorted by deadline
                const sortedDashboardTasks = [...filteredTasks].sort((a: any, b: any) => {
                  if (a.status === "completed" && b.status !== "completed") return 1;
                  if (a.status !== "completed" && b.status === "completed") return -1;
                  if (!a.deadline) return 1;
                  if (!b.deadline) return -1;
                  return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                });

                if (sortedDashboardTasks.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-[250px]">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                        <CheckCircle2 className="w-6 h-6 opacity-50" />
                      </div>
                      <p>No matching tasks found.</p>
                    </div>
                  );
                }

                return (
                  <ul className="divide-y divide-border/30">
                    {sortedDashboardTasks.map((task: any) => {
                      const isOverdue = task.deadline && isPast(new Date(task.deadline));
                      const isCompleted = task.status === "completed";
                      return (
                        <li key={task.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              onClick={() => toggleTaskStatus(task)}
                              className={cn(
                                "shrink-0 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                                isCompleted
                                  ? "bg-emerald-500 border-emerald-500 text-white animate-in zoom-in-50 duration-200"
                                  : "bg-background border-border hover:border-primary",
                              )}
                            >
                              {isCompleted && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <span className={cn(
                                "font-medium transition-colors block truncate",
                                isCompleted ? "text-muted-foreground" : "text-foreground"
                              )}>
                                {task.title}
                              </span>
                              {task.category && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-sm inline-block mt-1">
                                  {task.category}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.deadline && (
                            <div className={`text-xs font-medium whitespace-nowrap px-2.5 py-1 rounded-full ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                              {isOverdue ? 'Overdue' : format(new Date(task.deadline), 'MMM d, h:mm a')}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full border-border/50 shadow-sm">
            <CardHeader className="bg-muted/30 pb-4 border-b border-border/30">
              <CardTitle className="text-lg font-medium">Tasks by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[300px] flex items-center justify-center">
              {summary.byCategory.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  <p>No categorized tasks yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byCategory} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {summary.byCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function SummaryCard({ title, value, icon, trend }: { title: string; value: number; icon: React.ReactNode; trend: string }) {
  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-serif font-semibold">{value}</h3>
          </div>
          <p className="text-xs text-muted-foreground/80">{trend}</p>
        </div>
      </CardContent>
    </Card>
  );
}
