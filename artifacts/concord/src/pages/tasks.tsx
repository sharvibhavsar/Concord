import { useState, useEffect, useMemo } from "react";
import { 
  useGetTasks, getGetTasksQueryKey, 
  useUpdateTaskStatus, 
  useDeleteTask,
  useGetTask,
  useUpdateTask,
  useCreateTask,
  TaskPriority, TaskStatus,
  getGetTaskQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isPast } from "date-fns";
import { MoreVertical, Calendar, Tag, Trash2, CheckCircle2, Circle, Clock, Search, Filter, Edit2, Loader2, Layers, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export function TasksList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [search, setSearch] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  // Read URL query params for initial status filter
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const statusParam = searchParams.get("status");
    if (statusParam && ["pending", "in_progress", "completed", "all"].includes(statusParam)) {
      setFilterStatus(statusParam as any);
    }
  }, []);

  const params = {
    ...(filterStatus !== "all" && { status: filterStatus as TaskStatus }),
    ...(filterPriority !== "all" && { priority: filterPriority as TaskPriority }),
  };

  const { data: rawTasks, isLoading, isError } = useGetTasks(params, {
    query: { queryKey: getGetTasksQueryKey(params) }
  });

  const tasks: any[] = Array.isArray(rawTasks)
    ? rawTasks
    : Array.isArray((rawTasks as any)?.tasks)
    ? (rawTasks as any).tasks
    : [];

  const updateStatus = useUpdateTaskStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
      }
    }
  });

  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
      }
    }
  });

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
      }
    }
  });

  const handleStatusToggle = (id: number, currentStatus: TaskStatus) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending"
    };
    const target = nextStatus[currentStatus];
    updateStatus.mutate({ id, data: { status: target } });
    if (target === "completed") {
      toast({ title: "🎉 Great job!", description: "Task marked as completed." });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate({ id });
      toast({ title: "Task deleted", description: "Task has been removed." });
    }
  };

  const handleDuplicate = (task: any) => {
    const taskData = {
      rawInput: task.rawInput || task.title,
      title: `${task.title} (Copy)`,
      summary: task.summary || undefined,
      category: task.category || "General",
      priority: (task.priority || "medium") as any,
      status: "pending" as const,
      deadline: task.deadline || undefined,
      keywords: task.keywords || [],
      scheduledDate: task.scheduledDate || undefined,
      duration: task.duration || "30",
    };
    createTask.mutate(
      { data: taskData },
      {
        onSuccess: () => {
          toast({ title: "Task duplicated", description: `Created copy of "${task.title}".` });
        }
      }
    );
  };

  const handleArchive = (id: number) => {
    updateStatus.mutate({ id, data: { status: "completed" } });
    toast({ title: "Task archived", description: "Task moved to archive." });
  };


  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      const matchesSearch = search
        ? (t.title.toLowerCase().includes(search.toLowerCase()) || 
           (t.summary && t.summary.toLowerCase().includes(search.toLowerCase())))
        : true;
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      const matchesPriority = filterPriority === "all" || t.priority === filterPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, filterStatus, filterPriority]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a: any, b: any) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [filteredTasks]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif font-medium tracking-tight">Your Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track your workload.</p>
        </div>
      </div>

      <div className="bg-card p-4 rounded-xl border border-border/50 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search tasks..." 
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
            <SelectTrigger className="w-[140px] bg-background">
              <div className="flex items-center gap-2">
                <Filter className="w-3 h-3 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterPriority} onValueChange={(v: any) => setFilterPriority(v)}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-border/50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center p-12 bg-muted/20 rounded-xl border border-border/50">
          <p className="text-destructive font-medium">Failed to load tasks.</p>
        </div>
      ) : sortedTasks?.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-xl border border-border/50 shadow-sm">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-serif font-medium">No tasks found</h3>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
            {search || filterStatus !== 'all' || filterPriority !== 'all' 
              ? "Try adjusting your filters to see more results." 
              : "You don't have any tasks yet. Create one to get started!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {sortedTasks?.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={`border-border/50 shadow-sm transition-all hover:shadow-md ${task.status === 'completed' ? 'bg-muted/10 opacity-75 hover:opacity-100' : 'bg-card'}`}>
                  <CardContent className="p-5 flex gap-4">
                    <button 
                      onClick={() => handleStatusToggle(task.id, task.status)}
                      className="mt-1 shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : task.status === 'in_progress' ? (
                        <Clock className="w-6 h-6 text-blue-500" />
                      ) : (
                        <Circle className="w-6 h-6" />
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className={`font-medium text-lg truncate ${task.status === 'completed' ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {task.title}
                          </h3>
                          {task.summary && (
                            <p className="text-muted-foreground text-sm mt-1 line-clamp-2 leading-relaxed">
                              {task.summary}
                            </p>
                          )}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 -mr-2">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setEditingTaskId(task.id)}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit Task
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleDuplicate(task)}>
                              <Layers className="w-4 h-4 mr-2" />
                              Duplicate Task
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleArchive(task.id)}>
                              <Clock className="w-4 h-4 mr-2 text-amber-500" />
                              Archive Task
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => handleDelete(task.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Task
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        {task.priority === 'high' && (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-transparent shadow-none hover:bg-destructive/20 font-medium">
                            High Priority
                          </Badge>
                        )}
                        {task.priority === 'medium' && (
                          <Badge variant="secondary" className="bg-secondary/20 text-secondary-foreground border-transparent shadow-none hover:bg-secondary/30 font-medium">
                            Medium Priority
                          </Badge>
                        )}
                        {task.category && (
                          <Badge variant="outline" className="bg-background text-muted-foreground font-normal">
                            <Tag className="w-3 h-3 mr-1" />
                            {task.category}
                          </Badge>
                        )}
                        {task.deadline && (
                          <Badge 
                            variant="outline" 
                            className={`font-normal bg-background ${isPast(new Date(task.deadline)) && task.status !== 'completed' ? 'border-destructive text-destructive' : 'text-muted-foreground'}`}
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(new Date(task.deadline), "MMM d")}
                          </Badge>
                        )}
                        {task.keywords?.slice(0, 2).map((kw: string, i: number) => (
                          <span key={i} className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-sm">
                            #{kw}
                          </span>
                        ))}

                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {editingTaskId && (
        <EditTaskDialog 
          taskId={editingTaskId} 
          onClose={() => setEditingTaskId(null)} 
        />
      )}
    </div>
  );
}

function EditTaskDialog({ taskId, onClose }: { taskId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const localTask = useMemo(() => {
    const existing = JSON.parse(localStorage.getItem("concord_local_tasks") ?? "[]");
    return existing.find((t: any) => t.id === taskId);
  }, [taskId]);

  const { data: task, isLoading } = useGetTask(taskId, {
    query: { 
      queryKey: getGetTaskQueryKey(taskId),
      enabled: !localTask,
    }
  });

  const updateTask = useUpdateTask({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task updated", description: "Your changes have been saved." });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
        onClose();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
      }
    }
  });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [category, setCategory] = useState("");

  // Initialize form state once task is loaded
  useEffect(() => {
    if (localTask) {
      setTitle(localTask.title);
      setSummary(localTask.summary || "");
      setPriority(localTask.priority);
      setCategory(localTask.category || "");
    } else if (task) {
      setTitle(task.title);
      setSummary(task.summary || "");
      setPriority(task.priority);
      setCategory(task.category || "");
    }
  }, [task, localTask]);

  const handleSave = () => {
    const cleanTitle = (title ?? "").trim();
    if (!cleanTitle) return;

    if (localTask) {
      try {
        const existing = JSON.parse(localStorage.getItem("concord_local_tasks") ?? "[]");
        const updated = existing.map((t: any) => {
          if (t.id === taskId) {
            return {
              ...t,
              title: cleanTitle,
              summary: summary || null,
              priority: priority ?? "medium",
              category: category || null,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });
        localStorage.setItem("concord_local_tasks", JSON.stringify(updated));
        toast({ title: "Task updated", description: "Your changes have been saved." });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
        onClose();
      } catch (err) {
        toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
      }
    } else {
      updateTask.mutate({
        id: taskId,
        data: {
          title: cleanTitle,
          summary: summary || undefined,
          priority: priority ?? "medium",
          category: category || undefined,
        }
      });
    }
  };

  const isDialogLoading = localTask ? false : isLoading;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Task</DialogTitle>
          <DialogDescription>Modify task details.</DialogDescription>
        </DialogHeader>

        {isDialogLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title ?? ""} onChange={(e) => setTitle(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea 
                value={summary ?? ""} 
                onChange={(e) => setSummary(e.target.value)} 
                className="resize-none" 
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority ?? "medium"} onValueChange={(v: TaskPriority) => setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={category ?? ""} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Work, Personal" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateTask.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !(title ?? "").trim() || updateTask.isPending}>
            {updateTask.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
