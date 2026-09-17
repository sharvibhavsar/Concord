import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useOverdueMonitor } from "@/hooks/use-overdue-monitor";

export function OverdueTaskDialog() {
  const { overdueTask, dismissTask } = useOverdueMonitor();
  const [mode, setMode] = useState<"choose" | "reschedule">("choose");
  const [newDeadline, setNewDeadline] = useState("");

  if (!overdueTask) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />
        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Task Not Completed On Time</h2>
              <p className="text-xs text-muted-foreground">This task has passed its deadline.</p>
            </div>
          </div>

          <div className="bg-muted/40 rounded-xl p-4 mb-5">
            <p className="font-medium text-sm text-foreground">{overdueTask.title}</p>
            {overdueTask.deadline && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Deadline was: {format(new Date(overdueTask.deadline), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
            <span className={`text-xs font-medium capitalize mt-1 inline-block px-2 py-0.5 rounded-full ${overdueTask.priority === 'high' ? 'bg-red-100 text-red-700' : overdueTask.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
              {overdueTask.priority} priority
            </span>
          </div>

          {mode === "choose" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">What would you like to do?</p>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => setMode("reschedule")}>
                <RotateCcw className="w-4 h-4 text-primary" />
                <span>Reschedule for a new time</span>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive" onClick={() => dismissTask(overdueTask.id, "remove")}>
                <Trash2 className="w-4 h-4" />
                <span>Remove this task</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose a new deadline:</p>
              <Input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="h-11"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setMode("choose")}>Back</Button>
                <Button className="flex-1" disabled={!newDeadline} onClick={() => dismissTask(overdueTask.id, "reschedule", new Date(newDeadline).toISOString())}>
                  Reschedule
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
