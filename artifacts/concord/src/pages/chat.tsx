import { useState, useRef, useEffect } from "react";
import { useGetChatHistory, getGetChatHistoryQueryKey, useSendChatMessage, useUpdateTaskStatus, useDeleteTask, useGetTasks } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, Sparkles, CheckCircle2, Trash2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export function ChatAssistant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [tempMessages, setTempMessages] = useState<any[]>([]);

  const { data: rawHistory, isLoading } = useGetChatHistory({
    query: { queryKey: getGetChatHistoryQueryKey() }
  });

  const { data: rawTasks } = useGetTasks({});
  const apiTasks: any[] = Array.isArray(rawTasks)
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

  const sendMessage = useSendChatMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
        setTempMessages([]); // Clear temp messages when database history is refreshed
        setInput("");
      }
    }
  });

  const apiMessages: any[] = Array.isArray(rawHistory)
    ? rawHistory
    : Array.isArray((rawHistory as any)?.messages)
    ? (rawHistory as any).messages
    : [];

  const history = [...apiMessages, ...tempMessages];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, sendMessage.isPending]);

  function addTempMessage(role: "user" | "assistant", content: string) {
    const newMsg = {
      id: `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    setTempMessages((prev) => [...prev, newMsg]);
  }

  const handleInteractiveAction = (type: string, taskId: number, taskTitle: string) => {
    try {
      if (type === "complete") {
        updateStatus.mutate({ id: taskId, data: { status: "completed" } });
        addTempMessage("assistant", `✅ Task **"${taskTitle}"** has been marked as completed.`);
        toast({ title: "Task completed", description: `"${taskTitle}" marked as complete.` });
      } else if (type === "delete") {
        deleteTask.mutate({ id: taskId });
        addTempMessage("assistant", `🗑️ Task **"${taskTitle}"** has been deleted.`);
        toast({ title: "Task deleted", description: `"${taskTitle}" deleted successfully.` });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateOfflineResponse = async (message: string, localTasks: any[]): Promise<string> => {
    const lower = message.toLowerCase();

    // 1. Chained task detection
    const chain = /\b(and\s+)?then\b|\bafter\s+that\b|\bfollowed\s+by\b/i.test(lower);
    if (chain) {
      const segments = message
        .split(/\s*(?:;\s*|,\s*|\b(?:and\s+)?then\b|\bafter\s+that\b|\bfollowed\s+by\b|\bnext\b|\band\s+also\b)\s*/gi)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);

      if (segments.length > 1) {
        const addedTitles: string[] = [];
        for (const seg of segments) {
          let cleanTitle = seg.replace(/^(by|on|at|before|after|until|due)\s+/i, "").trim();
          cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
          
          try {
            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rawInput: seg,
                title: cleanTitle,
                category: "General",
                priority: "medium",
                status: "pending",
                scheduledDate: new Date().toISOString().split("T")[0],
                duration: "30",
              }),
            });
            addedTitles.push(cleanTitle);
          } catch (err) {
            console.error(err);
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        return `⛓️ **Chained Tasks Scheduled**:\nI have split your input and scheduled the following tasks:\n${addedTitles.map((t, idx) => `${idx + 1}. **${t}**`).join("\n")}`;
      }
    }

    // 2. "am i available on..." check
    if (lower.includes("available") || lower.includes("free on") || lower.includes("free time")) {
      const dayMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
      if (dayMatch) {
        const targetDay = parseInt(dayMatch[1], 10);
        const targetMonth = new Date().getMonth();
        const targetYear = new Date().getFullYear();
        const key = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
        
        const tasksOnDate = localTasks.filter((t: any) => {
          const dateStr = t.deadline || t.scheduledDate;
          return dateStr && dateStr.startsWith(key);
        });

        if (tasksOnDate.length === 0) {
          return `📅 Your calendar for **${key}** is clear! You have no tasks scheduled.`;
        }
        return `📅 On **${key}**, you have ${tasksOnDate.length} tasks scheduled:\n${tasksOnDate.map((t: any) => `• **${t.title}** [${t.priority}]`).join("\n")}`;
      }
    }

    // 3. Priority filters & dates
    const isHigh = lower.includes("high") || lower.includes("urgent");
    const isLow = lower.includes("low");
    const priority = isHigh ? "high" : isLow ? "low" : "medium";
    const priorityFilter = (isHigh || isLow) ? priority : null;

    const isToday = lower.includes("today");
    const isNextWeek = lower.includes("next week");

    let filtered = [...localTasks];
    if (priorityFilter) {
      filtered = filtered.filter((t: any) => t.priority === priorityFilter);
    }

    if (isToday) {
      const todayStr = new Date().toISOString().split("T")[0];
      filtered = filtered.filter((t: any) => {
        const dateStr = t.deadline || t.scheduledDate;
        return dateStr && dateStr.startsWith(todayStr);
      });
      return `🕒 Here are the ${priorityFilter ? priorityFilter + " priority " : ""}tasks for **today**:\n${filtered.length > 0 ? filtered.map((t: any) => `• **${t.title}**`).join("\n") : "No matching tasks found."}`;
    }

    if (isNextWeek) {
      const start = new Date();
      start.setDate(start.getDate() + (7 - start.getDay() + 1)); // next monday
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // next sunday
      
      filtered = filtered.filter((t: any) => {
        const dateStr = t.deadline || t.scheduledDate;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= start && d <= end;
      });
      return `📅 Here are the ${priorityFilter ? priorityFilter + " priority " : ""}tasks for **next week**:\n${filtered.length > 0 ? filtered.map((t: any) => `• **${t.title}**`).join("\n") : "No matching tasks found."}`;
    }

    if (isHigh) {
      return `🔴 Pending high-priority tasks:\n${filtered.length > 0 ? filtered.map((t: any) => `• **${t.title}**`).join("\n") : "No high-priority tasks found!"}`;
    }

    return `🤖 I'm here to help! You currently have ${localTasks.length} task(s) total. Try asking "What tasks are high priority?", "Am I available on the 23rd?", or "Show pending tasks."`;
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput("");

    addTempMessage("user", userText);

    // Read-only mutation checks on client-side
    const lower = userText.toLowerCase();
    const isComplete = /\b(complete|done|finish|tick|check)\b/i.test(lower) && /\b(task|event|item)\b/i.test(lower);
    const isDelete = /\b(delete|remove|cancel|discard)\b/i.test(lower) && /\b(task|event|item)\b/i.test(lower);
    const isEdit = /\b(change|edit|update|modify|reschedule)\b/i.test(lower) && /\b(task|deadline|priority|date|time)\b/i.test(lower);

    if (isComplete || isDelete || isEdit) {
      const words = lower.split(/\s+/).filter(w => w.length > 3);
      const matchedTask = apiTasks.find((t: any) => 
        words.some(word => t.title.toLowerCase().includes(word))
      );

      if (matchedTask) {
        let actionType = "";
        let actionMsg = "";
        if (isComplete) {
          actionType = "complete";
          actionMsg = `Mark "${matchedTask.title}" as Complete`;
        } else if (isDelete) {
          actionType = "delete";
          actionMsg = `Delete Task "${matchedTask.title}"`;
        } else {
          actionType = "edit";
          actionMsg = `Edit Task "${matchedTask.title}"`;
        }

        setTimeout(() => {
          addTempMessage("assistant", JSON.stringify({
            text: `⚠️ **Action Confirmation Required**: You requested to modify a task. Direct updates are restricted in chat. Please confirm below to perform this:`,
            interactive: true,
            type: actionType,
            taskId: matchedTask.id,
            taskTitle: matchedTask.title,
            label: actionMsg
          }));
        }, 300);
        return;
      }
    }

    sendMessage.mutate(
      { data: { content: userText } },
      {
        onError: () => {
          setTimeout(async () => {
            const reply = await generateOfflineResponse(userText, apiTasks);
            addTempMessage("assistant", reply);
          }, 400);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-medium tracking-tight">Assistant</h1>
        <p className="text-muted-foreground mt-1">Ask questions about your workload or search for tasks.</p>
      </div>

      <Card className="flex-1 border-border/50 shadow-sm flex flex-col overflow-hidden bg-card/50 backdrop-blur-sm">
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          {isLoading && history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Loading conversation...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-medium font-serif">How can I help?</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-2">
                  Try asking "What tasks are high priority?", "Summarize my workload", or "Show pending tasks."
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {[
                  "What tasks are high priority?",
                  "Summarize my workload",
                  "Show pending tasks",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); }}
                    className="text-xs bg-muted/60 hover:bg-muted text-muted-foreground px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((msg: any) => {
                let isInteractive = false;
                let actionData: any = null;
                let displayContent = msg.content;

                if (msg.role === "assistant" && msg.content.startsWith("{")) {
                  try {
                    actionData = JSON.parse(msg.content);
                    displayContent = actionData.text;
                    isInteractive = true;
                  } catch { }
                }

                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    
                    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-5 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-secondary text-secondary-foreground rounded-tr-sm' 
                          : 'bg-card border border-border/50 text-card-foreground rounded-tl-sm'
                      }`}>
                        {displayContent}

                        {isInteractive && actionData && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-xl border border-border/40 flex items-center gap-2">
                            {actionData.type === "complete" && (
                              <Button
                                size="sm"
                                onClick={() => handleInteractiveAction("complete", actionData.taskId, actionData.taskTitle)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                {actionData.label}
                              </Button>
                            )}
                            {actionData.type === "delete" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleInteractiveAction("delete", actionData.taskId, actionData.taskTitle)}
                                className="rounded-lg flex items-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4" />
                                {actionData.label}
                              </Button>
                            )}
                            {actionData.type === "edit" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.location.href = "/tasks"}
                                className="rounded-lg flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-4 h-4" />
                                Go to Tasks to Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1.5 px-1">
                        {msg.createdAt ? format(new Date(msg.createdAt), "h:mm a") : ""}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              {sendMessage.isPending && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 max-w-[85%]"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-card border border-border/50 px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce" />
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 bg-background border-t border-border/50">
          <div className="relative flex items-end gap-2 bg-card border border-border/60 rounded-2xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="min-h-[44px] max-h-32 resize-none border-0 shadow-none focus-visible:ring-0 p-3 bg-transparent text-base"
              disabled={sendMessage.isPending}
            />
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="mb-1 mr-1 shrink-0 rounded-xl h-10 w-10 shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
          <div className="text-center mt-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Shift + Enter for new line • Enter to send
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
