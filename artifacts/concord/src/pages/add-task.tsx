import { useState, useRef, useEffect, useCallback } from "react";
import { useParseTask, useCreateTask } from "@workspace/api-client-react";
import { useProfile } from "@/contexts/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Sparkles, Calendar, Tag, AlertCircle, Loader2, Check, Plus,
  Trash2, Layers, Clock, FileText, CheckCircle2, Edit3, Sliders, ArrowRight, AlertTriangle
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ParsedTask {
  rawInput: string;
  title: string;
  summary: string | null;
  category: string | null;
  priority: "low" | "medium" | "high";
  deadline: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  duration?: string | null;
  keywords: string[];
  intent?: string;
  taskType?: string;
  reminder?: string | null;
  recurrence?: string | null;
  dependencies?: string[];
  clarificationPrompt?: string | null;
  validationError?: string | null;
  mood?: {
    happy: number;
    sad: number;
    stress: number;
    fatigue: number;
    energy: number;
    label: string;
  } | null;
}

interface EditableTask extends ParsedTask {
  localTitle: string;
  localPriority: "low" | "medium" | "high";
  localDeadline: string; // "YYYY-MM-DD"
  localTime: string; // "HH:mm"
  localCategory: string;
}

const CATEGORIES = [
  "General", "Work", "Study", "Health", "Family", 
  "Finance", "Shopping", "Personal", "Meeting", "Project", "Custom"
];

const PRIORITY_COLORS = {
  high: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
};

export function AddTask() {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { profile, updateProfile } = useProfile();

  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);
  const [showWeekendConfirm, setShowWeekendConfirm] = useState(false);

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

  const validateTaskSchedule = (dateStr: string, timeStr?: string | null): { valid: boolean; error?: string; isWeekendHoliday?: boolean } => {
    if (!dateStr) return { valid: true };
    const now = new Date();
    let target: Date;
    try {
      if (timeStr) {
        target = new Date(`${dateStr}T${timeStr}:00`);
      } else {
        target = new Date(`${dateStr}T23:59:59`);
      }
    } catch {
      target = new Date(dateStr);
    }

    if (target < now) {
      return { valid: false, error: "You cannot schedule a task in the past." };
    }

    const tenYearsFromNow = new Date();
    tenYearsFromNow.setFullYear(now.getFullYear() + 10);
    if (target > tenYearsFromNow) {
      return { valid: false, error: "You cannot schedule a task more than 10 years in the future." };
    }

    const isHoliday = getIsWeekendHoliday(target);
    if (isHoliday && !profile?.weekendAvailable) {
      return { valid: true, isWeekendHoliday: true };
    }

    return { valid: true };
  };

  const parseTask = useParseTask();
  const createTask = useCreateTask();

  // Multi-task mode states
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [editableTasks, setEditableTasks] = useState<EditableTask[]>([]);
  const [multiParsing, setMultiParsing] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Single task editable preview state
  const [editedSingleTitle, setEditedSingleTitle] = useState("");
  const [editedSinglePriority, setEditedSinglePriority] = useState<"low" | "medium" | "high">("medium");
  const [editedSingleCategory, setEditedSingleCategory] = useState("General");
  const [editedSingleDate, setEditedSingleDate] = useState("");
  const [editedSingleTime, setEditedSingleTime] = useState("");
  const [editedSingleDeadline, setEditedSingleDeadline] = useState("");
  const [editedSingleDuration, setEditedSingleDuration] = useState("");
  const [extractedMood, setExtractedMood] = useState<ParsedTask["mood"]>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Manual entry form state
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("General");
  const [manualCustomCategory, setManualCustomCategory] = useState("");
  const [manualPriority, setManualPriority] = useState<"low" | "medium" | "high">("medium");
  const [manualDate, setManualDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [manualTime, setManualTime] = useState("");
  const [manualDeadline, setManualDeadline] = useState("");
  const [manualDuration, setManualDuration] = useState("30");
  const [manualNotes, setManualNotes] = useState("");
  const [manualReminder, setManualReminder] = useState("15m");
  const [manualMood, setManualMood] = useState<"happy" | "stressed" | "tired" | "neutral">("neutral");

  // Conflict / Duplicate warnings
  const [singleWarning, setSingleWarning] = useState<{ duplicate: boolean; conflict: boolean; conflictTitle?: string } | null>(null);
  const [manualWarning, setManualWarning] = useState<{ duplicate: boolean; conflict: boolean; conflictTitle?: string } | null>(null);

  const parseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const multiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync parsed single task data to editable state
  useEffect(() => {
    if (parseTask.data) {
      const p = parseTask.data as ParsedTask;
      setEditedSingleTitle(p.title || input.slice(0, 50));
      setEditedSinglePriority(p.priority || "medium");
      setEditedSingleCategory(p.category || "General");
      
      if (p.scheduledDate) {
        setEditedSingleDate(p.scheduledDate);
      } else if (p.deadline) {
        setEditedSingleDate(p.deadline.split("T")[0]);
      } else {
        setEditedSingleDate("");
      }

      setEditedSingleTime(p.scheduledTime || "");
      
      if (p.deadline) {
        setEditedSingleDeadline(p.deadline.split("T")[0]);
      } else {
        setEditedSingleDeadline("");
      }

      setEditedSingleDuration(p.duration || "");
      setExtractedMood(p.mood ?? null);
    }
  }, [parseTask.data]);

  // Client-side warnings checks
  const runConflictCheck = (title: string, date: string, time: string | null, durationStr?: string | null) => {
    if (!date) return { duplicate: false, conflict: false };
    const localTasks = JSON.parse(localStorage.getItem("concord_local_tasks") ?? "[]");

    const duplicate = localTasks.some((t: any) => 
      t.title.toLowerCase().trim() === title.toLowerCase().trim() && 
      (t.scheduledDate === date || (t.deadline && t.deadline.split("T")[0] === date))
    );

    let conflict = false;
    let conflictTitle = "";
    if (time) {
      const getMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
      };

      const newStart = getMinutes(time);
      const newDuration = Number(durationStr) || 30;
      const newEnd = newStart + newDuration;

      const matched = localTasks.find((t: any) => {
        const tDate = t.scheduledDate || (t.deadline ? t.deadline.split("T")[0] : null);
        const tTime = t.scheduledTime || (t.deadline && t.deadline.includes("T") ? t.deadline.split("T")[1].slice(0, 5) : null);
        if (tDate === date && tTime && t.title.toLowerCase().trim() !== title.toLowerCase().trim()) {
          const tStart = getMinutes(tTime);
          const tDuration = Number(t.duration) || 30;
          const tEnd = tStart + tDuration;
          return newStart < tEnd && tStart < newEnd;
        }
        return false;
      });

      if (matched) {
        const matchedTime = matched.scheduledTime || (matched.deadline && matched.deadline.includes("T") ? matched.deadline.split("T")[1].slice(0, 5) : "00:00");
        conflict = true;
        conflictTitle = `${matched.title} (${matchedTime} for ${matched.duration || 30} mins)`;
      }
    }

    return { duplicate, conflict, conflictTitle };
  };

  useEffect(() => {
    if (mode === "ai" && !isMultiMode && editedSingleTitle) {
      const warn = runConflictCheck(editedSingleTitle, editedSingleDate, editedSingleTime, editedSingleDuration);
      if (warn.duplicate || warn.conflict) {
        setSingleWarning(warn);
      } else {
        setSingleWarning(null);
      }
    }
  }, [editedSingleTitle, editedSingleDate, editedSingleTime, editedSingleDuration, mode, isMultiMode]);

  useEffect(() => {
    if (mode === "manual" && manualTitle) {
      const warn = runConflictCheck(manualTitle, manualDate, manualTime, manualDuration);
      if (warn.duplicate || warn.conflict) {
        setManualWarning(warn);
      } else {
        setManualWarning(null);
      }
    }
  }, [manualTitle, manualDate, manualTime, manualDuration, mode]);

  function parseFlexibleTime(text: string): string | null {
    const lower = text.toLowerCase().trim();

    // 1. Direct formats like 19:37, 08:45, 12:00, 8:30
    const directMatch = lower.match(/\b(\d{1,2}):(\d{2})\b/);
    if (directMatch) {
      const hh = parseInt(directMatch[1], 10);
      const mm = parseInt(directMatch[2], 10);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
    }

    // 2. Phrases like "today evening 7", "evening 7", "morning 8", "noon"
    let hours = -1;
    let minutes = 0;
    let isAm = false;
    let isPm = false;

    if (/\bnoon\b/i.test(lower)) return "12:00";
    if (/\bmidnight\b/i.test(lower)) return "00:00";

    if (/\b(evening|night|afternoon|pm)\b/i.test(lower)) isPm = true;
    if (/\b(morning|am)\b/i.test(lower)) isAm = true;

    const quarterPastMatch = lower.match(/\bquarter\s+past\s+(\d{1,2})\b/i);
    const quarterToMatch = lower.match(/\bquarter\s+to\s+(\d{1,2})\b/i);
    const halfPastMatch = lower.match(/\bhalf\s+past\s+(\d{1,2})\b/i);

    if (quarterPastMatch) {
      hours = parseInt(quarterPastMatch[1], 10);
      minutes = 15;
    } else if (quarterToMatch) {
      hours = parseInt(quarterToMatch[1], 10) - 1;
      if (hours < 0) hours = 23;
      minutes = 45;
    } else if (halfPastMatch) {
      hours = parseInt(halfPastMatch[1], 10);
      minutes = 30;
    }

    if (hours === -1) {
      const singleHourMatch = lower.match(/\b(?:evening|night|morning|afternoon|at)?\s*(\d{1,2})\s*(?:o'clock)?\b/i) || lower.match(/\b(\d{1,2})\s*(?:am|pm)\b/i);
      if (singleHourMatch) {
        hours = parseInt(singleHourMatch[1], 10);
      }
    }

    if (hours !== -1 && hours >= 0 && hours <= 24) {
      if (isPm && hours < 12) {
        hours += 12;
      } else if (isAm && hours === 12) {
        hours = 0;
      } else if (!isAm && !isPm) {
        if (lower.includes("evening") || lower.includes("night") || lower.includes("afternoon")) {
          if (hours < 12) hours += 12;
        } else if (hours >= 1 && hours <= 6) {
          hours += 12;
        }
      }
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    return null;
  }
  function fallbackParseTask(rawInput: string): ParsedTask {
    const clean = rawInput.trim();
    const lower = clean.toLowerCase();

    let category = "General";
    if (/work|meeting|email|report|presentation|project|code|client|deploy|interview/i.test(clean)) {
      category = "Work";
    } else if (/study|course|exam|read|book|class|learn/i.test(clean)) {
      category = "Study";
    } else if (/workout|gym|run|exercise|health|doctor|medicine|meditate/i.test(clean)) {
      category = "Health";
    } else if (/buy|grocery|store|shop|amazon|order/i.test(clean)) {
      category = "Shopping";
    } else if (/pay|bill|tax|rent|bank|money|finance/i.test(clean)) {
      category = "Finance";
    }

    let scheduledDate: string | null = null;
    let scheduledTime: string | null = null;
    let deadline: string | null = null;
    const now = new Date();

    let dateMentioned = false;
    let timeMentioned = false;

    // Custom parsing for ordinal dates: e.g. "on 29th", "on 28th next month", "on 16th december", "29th"
    const ordinalDateMatch = lower.match(/(?:\bon\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+(next\s+month|january|february|march|april|may|june|july|august|september|october|november|december|dec|nov|oct|sept|aug|jul|jun|apr|mar|feb|jan))?/i) ||
                             lower.match(/(?:\bon\s+)(\d{1,2})\b(?:\s+(next\s+month|january|february|march|april|may|june|july|august|september|october|november|december|dec|nov|oct|sept|aug|jul|jun|apr|mar|feb|jan))?/i);
    if (ordinalDateMatch) {
      dateMentioned = true;
      const dayVal = parseInt(ordinalDateMatch[1], 10);
      const monthWord = ordinalDateMatch[2] ? ordinalDateMatch[2].trim().toLowerCase() : "";

      let targetYear = now.getFullYear();
      let targetMonth = now.getMonth(); // 0-indexed

      if (monthWord === "next month") {
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      } else if (monthWord) {
        const monthsMap: Record<string, number> = {
          january: 0, jan: 0,
          february: 1, feb: 1,
          march: 2, mar: 2,
          april: 3, apr: 3,
          may: 4,
          june: 5, jun: 5,
          july: 6, jul: 6,
          august: 7, aug: 7,
          september: 8, sept: 8,
          october: 9, oct: 9,
          november: 10, nov: 10,
          december: 11, dec: 11
        };
        if (monthsMap[monthWord] !== undefined) {
          targetMonth = monthsMap[monthWord];
        }
      }

      const matchIndex = lower.indexOf(ordinalDateMatch[0]);
      const prefix = matchIndex > 0 ? lower.slice(0, matchIndex).trim() : "";
      const isBy = /\b(by|before|until|no later than)\b$/i.test(prefix);

      const matchedTime = parseFlexibleTime(lower);
      if (matchedTime) {
        timeMentioned = true;
        scheduledTime = matchedTime;
      }

      if (isBy) {
        deadline = new Date(targetYear, targetMonth, dayVal, 0, 0, 0).toISOString();
        scheduledDate = null;
      } else {
        scheduledDate = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(dayVal).padStart(2, "0")}`;
      }
    }

    // Time detection
    const matchedTime = parseFlexibleTime(lower);
    if (matchedTime) {
      timeMentioned = true;
      scheduledTime = matchedTime;
    }

    // Next Month
    if (!scheduledDate && !deadline) {
      if (lower.includes("next month")) {
        dateMentioned = true;
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        scheduledDate = format(nextMonth, "yyyy-MM-dd");
        scheduledTime = null;
        const lastDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        deadline = lastDayOfNextMonth.toISOString();
      }
      // Next [weekday]
      else {
        const nextWeekdayMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
        if (nextWeekdayMatch) {
          dateMentioned = true;
          const targetDay = nextWeekdayMatch[1];
          const daysMap: Record<string, number> = {
            monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0
          };
          const targetDayNum = daysMap[targetDay];
          const currentDayNum = now.getDay();
          let diff = targetDayNum - currentDayNum;
          if (diff <= 0) diff += 7;
          diff += 7; // Go to next week
          const resolvedDate = addDays(now, diff);
          scheduledDate = format(resolvedDate, "yyyy-MM-dd");
          scheduledTime = null;
          deadline = null;
        }
      }
    }

    // Preposition checks for by, before, until
    const isBy = /\b(by|before|until|no later than)\b/i.test(lower);

    // Today / Tomorrow checks
    if (!scheduledDate && !deadline) {
      if (/today/i.test(clean)) {
        dateMentioned = true;
        if (isBy) {
          deadline = now.toISOString();
        } else {
          scheduledDate = format(now, "yyyy-MM-dd");
        }
      } else if (/tomorrow/i.test(clean)) {
        dateMentioned = true;
        if (isBy) {
          deadline = addDays(now, 1).toISOString();
        } else {
          scheduledDate = format(addDays(now, 1), "yyyy-MM-dd");
        }
      }
    }

    // "before lunch" -> deadline today 12:00 PM
    if (lower.includes("before lunch")) {
      deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
      timeMentioned = true;
    }

    // Default Date/Time Rules
    if (!scheduledDate && !deadline) {
      scheduledDate = format(now, "yyyy-MM-dd");
      if (!timeMentioned) {
        scheduledTime = "00:00";
      }
    }

    if (scheduledDate && scheduledTime && !deadline && !isBy) {
      // Do not assume deadline unless user specified
      deadline = null;
    }

    // Priority default: medium unless tomorrow or urgent/quick/fast
    let priority: "low" | "medium" | "high" = "medium";
    const tomorrowStr = format(addDays(now, 1), "yyyy-MM-dd");
    if (/\b(urgent|quick|fast|asap|immediately|important)\b/i.test(lower)) {
      priority = "high";
    } else if (scheduledDate === tomorrowStr) {
      priority = "high";
    } else {
      priority = "medium";
    }

    // Clean title
    let cleanTitle = clean;
    if (ordinalDateMatch) {
      cleanTitle = cleanTitle.replace(new RegExp(ordinalDateMatch[0], "i"), "").trim();
    }

    cleanTitle = cleanTitle.replace(/\bat\s+night\s+\d{1,2}\b/i, "");
    cleanTitle = cleanTitle.replace(/\bnight\s+\d{1,2}\b/i, "");
    cleanTitle = cleanTitle.replace(/\bat\s+\d{1,2}\s*(?:am|pm|pm|am)?\b/i, "");
    cleanTitle = cleanTitle.replace(/\bat\s+\d{1,2}:\d{2}\b/i, "");
    cleanTitle = cleanTitle.replace(/\bat\s+4pm\b/i, "");
    cleanTitle = cleanTitle.replace(/\bat\s+airport\b/i, "");
    cleanTitle = cleanTitle.replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, "");
    cleanTitle = cleanTitle.replace(/\bnext\s+month\b/i, "");
    cleanTitle = cleanTitle.replace(/\btomorrow\b/i, "");
    cleanTitle = cleanTitle.replace(/\btoday\b/i, "");

    cleanTitle = cleanTitle
      .replace(/^(by|on|at|before|after|until|due)\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    let title = cleanTitle || "New Task";
    let summary = null;
    
    if (lower.startsWith("buy ") && (lower.includes(",") || lower.includes(" and "))) {
      title = "Buy Groceries";
      const itemsText = cleanTitle.replace(/^buy\s+/i, "");
      const items = itemsText.split(/,|\band\b/gi).map(i => i.trim()).filter(Boolean);
      summary = items.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join("\n");
    } else {
      summary = clean.length > 30 ? `Parsed task: "${clean}"` : null;
    }

    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      rawInput: clean,
      title,
      summary,
      category,
      priority,
      deadline,
      scheduledDate,
      scheduledTime,
      duration: "30",
      keywords: clean.split(/\s+/).filter((w) => w.length > 3).slice(0, 5),
    };
  }

  function fallbackParseMulti(rawInput: string): ParsedTask[] {
    const segments = rawInput
      .split(/\s*(?:;\s*|,\s*|\b(?:and\s+)?then\b|\bafter\s+that\b|\bfollowed\s+by\b|\bnext\b|\band\s+also\b)\s*/gi)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (segments.length === 0) return [fallbackParseTask(rawInput)];
    return segments.map((seg) => fallbackParseTask(seg));
  }

  // Single-task debounced parse
  const debouncedParse = useCallback((text: string) => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    if (!text.trim()) { parseTask.reset(); return; }
    parseTimerRef.current = setTimeout(() => {
      parseTask.mutate({ data: { rawInput: text } });
    }, 400);
  }, [parseTask]);

  // Multi-task debounced parse
  const debouncedMultiParse = useCallback((text: string) => {
    if (multiTimerRef.current) clearTimeout(multiTimerRef.current);
    if (!text.trim()) { setEditableTasks([]); return; }
    setMultiParsing(true);
    multiTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/tasks/parse-multi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ rawInput: text }),
        });
        if (!res.ok) throw new Error("API parse multi failed");
        const results: ParsedTask[] = await res.json();
        setEditableTasks(results.map((t) => ({
          ...t,
          localTitle: t.title,
          localPriority: t.priority,
          localCategory: t.category || "General",
          localDeadline: t.deadline ? format(new Date(t.deadline), "yyyy-MM-dd") : "",
          localTime: "",
        })));
      } catch {
        const fallbacks = fallbackParseMulti(text);
        setEditableTasks(fallbacks.map((t) => ({
          ...t,
          localTitle: t.title,
          localPriority: t.priority,
          localCategory: t.category || "General",
          localDeadline: t.deadline ? format(new Date(t.deadline), "yyyy-MM-dd") : "",
          localTime: "",
        })));
      } finally {
        setMultiParsing(false);
      }
    }, 400);
  }, []);

  useEffect(() => {
    if (mode !== "ai") return;
    const chain = /\b(and\s+)?then\b|\bafter\s+that\b|\bfollowed\s+by\b/i.test(input);
    setIsMultiMode(chain);
    if (chain) {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      parseTask.reset();
      debouncedMultiParse(input);
    } else {
      if (multiTimerRef.current) clearTimeout(multiTimerRef.current);
      setEditableTasks([]);
      if (input.trim()) {
        const p = fallbackParseTask(input);
        setEditedSingleTitle(p.title);
        setEditedSinglePriority(p.priority || "medium");
        setEditedSingleCategory(p.category || "General");
        setEditedSingleDate(p.scheduledDate || "");
        setEditedSingleTime(p.scheduledTime || "");
        setEditedSingleDeadline(p.deadline ? p.deadline.split("T")[0] : "");
        setEditedSingleDuration(p.duration || "30");
        setExtractedMood(p.mood ?? null);
      }
      debouncedParse(input);
    }
  }, [input, mode]);

  function saveLocalTask(taskData: any) {
    try {
      const existing = JSON.parse(localStorage.getItem("concord_local_tasks") ?? "[]");
      const newTask = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rawInput: taskData.rawInput ?? "",
        title: taskData.title ?? "New Task",
        summary: taskData.summary ?? null,
        category: taskData.category ?? "General",
        priority: taskData.priority ?? "medium",
        status: "pending",
        deadline: taskData.deadline ?? null,
        scheduledDate: taskData.scheduledDate ?? format(new Date(), "yyyy-MM-dd"),
        scheduledTime: taskData.scheduledTime ?? null,
        duration: taskData.duration ?? "30",
        notes: taskData.notes ?? null,
        keywords: taskData.keywords ?? [],
        mood: taskData.mood ?? null,
      };
      existing.unshift(newTask);
      localStorage.setItem("concord_local_tasks", JSON.stringify(existing));

      // Stage 6: Store Mood History locally if mood is present
      if (taskData.mood) {
        const moodHist = JSON.parse(localStorage.getItem("concord_local_mood") ?? "[]");
        moodHist.push({
          ...taskData.mood,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem("concord_local_mood", JSON.stringify(moodHist));
      }
    } catch (err) {
      console.error("Failed to save local task:", err);
    }
  }

  // Quick buttons helpers for Clarification Flow (Stage 8)
  const getNextMonday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    return format(addDays(today, diff), "yyyy-MM-dd");
  };

  // ── Save Single AI Task ──────────────────────────────────────────────
  const handleSaveAISingle = () => {
    if (!input.trim() && !editedSingleTitle.trim()) return;
    setShowSaveConfirm(true);
  };

  const proceedSave = (data: any) => {
    const { mood, ...taskDataOnly } = data;
    createTask.mutate(
      { data: taskDataOnly },
      {
        onSuccess: async () => {
          if (mood) {
            try {
              await fetch(`${BASE_URL}/api/mood`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mood),
              });
            } catch (err) {
              console.error("Failed to save mood:", err);
            }
          }
          toast({ title: "Task created 🎉", description: `"${data.title}" added to calendar and task list.` });
          setLocation("/tasks");
        },
        onError: () => {
          toast({ title: "Error creating task", description: "Failed to connect to the backend server.", variant: "destructive" });
        },
      }
    );
  };

  const executeSaveSingle = () => {
    const taskTitle = editedSingleTitle.trim() || input.slice(0, 50);
    const dateToSave = editedSingleDate || format(new Date(), "yyyy-MM-dd");
    
    let deadlineISO = undefined;
    if (dateToSave) {
      const timePart = editedSingleTime ? `T${editedSingleTime}:00` : "T00:00:00";
      try {
        deadlineISO = new Date(`${dateToSave}${timePart}`).toISOString();
      } catch {
        deadlineISO = new Date(dateToSave).toISOString();
      }
    }

    const taskData = {
      rawInput: input,
      title: taskTitle,
      summary: parseTask.data?.summary ?? undefined,
      category: editedSingleCategory,
      priority: editedSinglePriority,
      deadline: deadlineISO,
      scheduledDate: dateToSave,
      scheduledTime: editedSingleTime || "00:00",
      duration: editedSingleDuration || "30",
      keywords: parseTask.data?.keywords ?? [],
      status: "pending" as const,
      mood: extractedMood,
      recurrence: (parseTask.data as any)?.recurrence ?? undefined,
      dependencies: (parseTask.data as any)?.dependencies ?? [],
      reminder: (parseTask.data as any)?.reminder ?? undefined,
    };

    const validation = validateTaskSchedule(dateToSave, editedSingleTime);
    if (!validation.valid) {
      toast({ title: "Invalid Date 🛑", description: validation.error, variant: "destructive" });
      return;
    }

    if (validation.isWeekendHoliday) {
      setPendingSaveAction(() => () => proceedSave(taskData));
      setShowWeekendConfirm(true);
      return;
    }

    proceedSave(taskData);
  };

  // ── Save Multi AI Tasks ──────────────────────────────────────────────
  const handleSaveAIMulti = async () => {
    if (editableTasks.length === 0) return;
    setSavingAll(true);
    let succeededCount = 0;
    try {
      for (const t of editableTasks) {
        const deadlineISO = t.localDeadline ? new Date(t.localDeadline).toISOString() : undefined;
        const taskData = {
          rawInput: t.rawInput || t.localTitle,
          title: t.localTitle || t.title,
          summary: t.summary ?? undefined,
          category: t.localCategory || "General",
          priority: t.localPriority || "medium",
          deadline: deadlineISO,
          scheduledDate: t.localDeadline || format(new Date(), "yyyy-MM-dd"),
          keywords: t.keywords ?? [],
          status: "pending" as const,
        };

        try {
          await new Promise<void>((resolve, reject) => {
            createTask.mutate(
              { data: taskData },
              {
                onSuccess: () => {
                  succeededCount++;
                  resolve();
                },
                onError: () => reject(new Error("Save failed")),
              }
            );
          });
        } catch (err) {
          console.error("Failed to save task in chain:", err);
        }
      }
      if (succeededCount > 0) {
        toast({
          title: `${succeededCount} tasks created! 🎉`,
          description: "Chained tasks have been added to your calendar and list.",
        });
      } else {
        toast({
          title: "Error saving tasks",
          description: "Failed to connect to the backend server.",
          variant: "destructive",
        });
      }
      setLocation("/tasks");
    } catch {
      toast({ title: "Error", description: "Could not save tasks.", variant: "destructive" });
    } finally {
      setSavingAll(false);
    }
  };

  const proceedSaveManual = (data: any) => {
    createTask.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Task created 🎉", description: `"${data.title}" saved to tasks & calendar.` });
          setLocation("/tasks");
        },
        onError: () => {
          toast({ title: "Error creating task", description: "Failed to connect to the backend server.", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveManual = () => {
    if (!manualTitle.trim()) {
      toast({ title: "Task title required", description: "Please enter a title for your task.", variant: "destructive" });
      return;
    }

    const finalCategory = manualCategory === "Custom" && manualCustomCategory.trim() 
      ? manualCustomCategory.trim() 
      : manualCategory;

    let deadlineISO = undefined;
    if (manualDate) {
      const timePart = manualTime ? `T${manualTime}:00` : "T09:00:00";
      try {
        deadlineISO = new Date(`${manualDate}${timePart}`).toISOString();
      } catch {
        deadlineISO = new Date(manualDate).toISOString();
      }
    }

    // Set mood ratings based on picker
    const moodRatings: Record<string, any> = {
      happy: { happy: 8, sad: 0, stress: 2, fatigue: 2, energy: 8, label: "happy" },
      stressed: { happy: 3, sad: 2, stress: 8, fatigue: 4, energy: 6, label: "stressed" },
      tired: { happy: 4, sad: 2, stress: 3, fatigue: 8, energy: 2, label: "tired" },
      neutral: { happy: 5, sad: 0, stress: 3, fatigue: 3, energy: 5, label: "neutral" },
    };

    const taskData = {
      rawInput: manualTitle,
      title: manualTitle.trim(),
      summary: manualNotes.trim() || undefined,
      category: finalCategory,
      priority: manualPriority,
      scheduledDate: manualDate,
      scheduledTime: manualTime || undefined,
      deadline: deadlineISO,
      duration: manualDuration,
      notes: manualNotes.trim() || undefined,
      keywords: [finalCategory.toLowerCase(), manualPriority],
      status: "pending" as const,
      mood: moodRatings[manualMood],
    };

    const validation = validateTaskSchedule(manualDate, manualTime);
    if (!validation.valid) {
      toast({ title: "Invalid Date 🛑", description: validation.error, variant: "destructive" });
      return;
    }

    if (validation.isWeekendHoliday) {
      setPendingSaveAction(() => () => proceedSaveManual(taskData));
      setShowWeekendConfirm(true);
      return;
    }

    proceedSaveManual(taskData);
  };

  const updateField = <K extends keyof EditableTask>(idx: number, field: K, val: EditableTask[K]) => {
    setEditableTasks((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  };

  const removeTask = (idx: number) => {
    setEditableTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight">Add New Task</h1>
          <p className="text-muted-foreground mt-1">
            Choose AI Natural Language understanding or Manual Form Entry.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-muted p-1 rounded-xl border border-border/50 self-start">
          <button
            onClick={() => setMode("ai")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === "ai"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="w-4 h-4 text-primary" />
            AI Natural Language
          </button>
          <button
            onClick={() => setMode("manual")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === "manual"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Edit3 className="w-4 h-4 text-primary" />
            Manual Entry
          </button>
        </div>
      </div>

      {/* ── MODE A: AI NATURAL LANGUAGE PLANNER ────────────────────────────────── */}
      {mode === "ai" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Describe what needs to be done — or chain tasks with <strong>then</strong>, <strong>after that</strong>, etc.
            </Label>
            <Textarea
              id="task-input"
              placeholder={
                isMultiMode
                  ? "e.g. Work on project then prepare report then presentation and then show it to ma'am by 21st August"
                  : "e.g. Prepare the Q3 marketing presentation next Tuesday at 2pm. High priority."
              }
              className="min-h-[140px] text-lg leading-relaxed p-5 resize-none rounded-2xl border-border/60 focus-visible:ring-primary/20 shadow-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />

            {isMultiMode && (
              <div className="flex items-center gap-2 text-sm text-primary px-1 font-medium">
                <Layers className="w-4 h-4" />
                <span>Multi-task chain detected! Concord will break this down into separate task cards below.</span>
              </div>
            )}
          </div>

          {/* Validation Error Banner */}
          {(parseTask.data as any)?.validationError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 text-sm shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <div>
                <span className="font-semibold block text-rose-900">Validation Warning</span>
                <span className="text-rose-700">{(parseTask.data as any).validationError}</span>
              </div>
            </div>
          )}

          {/* Clarification Prompt Box */}
          {(parseTask.data as any)?.clarificationPrompt && (
            <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl flex items-start gap-3 text-sm shadow-sm">
              <Sparkles className="w-5 h-5 shrink-0 text-blue-600 animate-pulse" />
              <div>
                <span className="font-semibold block text-blue-900">NLP Clarification Recommendation</span>
                <span className="text-blue-700">{(parseTask.data as any).clarificationPrompt}</span>
              </div>
            </div>
          )}

          {/* STAGE 8: CLARIFICATION FLOW BANNER */}
          {!isMultiMode && input.trim() && (
            <AnimatePresence>
              {(!editedSingleDate || !editedSingleTime || !editedSingleDuration) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-primary/5 border border-primary/25 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <AlertCircle className="w-5 h-5" />
                    <span>Concord AI Clarification Flow: Please fill in missing details</span>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Date Clarification */}
                    {!editedSingleDate && (
                      <div className="space-y-1.5 flex-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          📅 Which day?
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDate(format(new Date(), "yyyy-MM-dd"))}>
                            Today
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDate(format(addDays(new Date(), 1), "yyyy-MM-dd"))}>
                            Tomorrow
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDate(getNextMonday())}>
                            Next Monday
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Time Clarification */}
                    {!editedSingleTime && (
                      <div className="space-y-1.5 flex-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          🕒 What time?
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleTime("08:00")}>
                            Morning (8 AM)
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleTime("15:00")}>
                            Afternoon (3 PM)
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleTime("19:00")}>
                            Evening (7 PM)
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleTime("21:00")}>
                            Night (9 PM)
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Duration Clarification */}
                    {!editedSingleDuration && (
                      <div className="space-y-1.5 flex-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          ⏳ Approximately how long?
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDuration("15")}>
                            15m
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDuration("30")}>
                            30m
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDuration("60")}>
                            1h
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditedSingleDuration("120")}>
                            2h
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* SINGLE TASK AI BREAKDOWN & EDITABLE PREVIEW (Stage 9) */}
          {!isMultiMode && (
            <div className="grid md:grid-cols-5 gap-8">
              <div className="md:col-span-3 space-y-6">
                <Card className="border-border/50 shadow-sm bg-card">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-serif font-medium flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-primary" />
                        AI Extracted Task & Custom Edits
                      </span>
                      <Badge variant="outline" className="text-xs font-normal">
                        Editable Before Save
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {/* Warnings (Duplicate & Conflict checks) */}
                    {singleWarning && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1 text-xs">
                        {singleWarning.duplicate && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>A task with this name is already scheduled on this day.</span>
                          </div>
                        )}
                        {singleWarning.conflict && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Conflict: Overlaps with task <strong>"{singleWarning.conflictTitle}"</strong> at {editedSingleTime}.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Task Title */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Task Name *
                      </Label>
                      <Input
                        value={editedSingleTitle}
                        onChange={(e) => setEditedSingleTitle(e.target.value)}
                        placeholder="Task title"
                        className="rounded-xl border-border/60"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Priority */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Priority
                        </Label>
                        <Select
                          value={editedSinglePriority}
                          onValueChange={(v) => setEditedSinglePriority(v as any)}
                        >
                          <SelectTrigger className={cn("rounded-xl text-xs font-medium border", PRIORITY_COLORS[editedSinglePriority])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">🔴 High</SelectItem>
                            <SelectItem value="medium">🟡 Medium</SelectItem>
                            <SelectItem value="low">🟢 Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Category */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Category
                        </Label>
                        <Select
                          value={editedSingleCategory}
                          onValueChange={(v) => setEditedSingleCategory(v)}
                        >
                          <SelectTrigger className="rounded-xl text-xs font-medium border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Scheduled Date */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Date
                        </Label>
                        <Input
                          type="date"
                          value={editedSingleDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setEditedSingleDate(e.target.value)}
                          className="rounded-xl border-border/60 text-xs"
                        />
                      </div>

                      {/* Deadline */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Deadline (Optional)
                        </Label>
                        <Input
                          type="date"
                          value={editedSingleDeadline}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setEditedSingleDeadline(e.target.value)}
                          className="rounded-xl border-border/60 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Time */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Scheduled Time
                        </Label>
                        <Input
                          type="time"
                          value={editedSingleTime}
                          onChange={(e) => setEditedSingleTime(e.target.value)}
                          className="rounded-xl border-border/60 text-xs"
                        />
                      </div>

                      {/* Duration */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Duration (Minutes)
                        </Label>
                        <Input
                          type="number"
                          value={editedSingleDuration}
                          onChange={(e) => setEditedSingleDuration(e.target.value)}
                          placeholder="30"
                          className="rounded-xl border-border/60 text-xs"
                        />
                      </div>
                    </div>

                    {/* Action Save Button */}
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="lg"
                        onClick={handleSaveAISingle}
                        disabled={!input.trim() && !editedSingleTitle.trim()}
                        className="rounded-full px-8 shadow-md"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        Save Task
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Understanding Live Card */}
              <div className="md:col-span-2">
                <Card className="h-full border-border/50 shadow-sm bg-muted/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Sparkles className="w-32 h-32" />
                  </div>
                  <CardContent className="p-6 relative z-10 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <h3 className="font-serif font-medium text-lg">AI Understanding Breakdown</h3>
                    </div>

                    {!input.trim() ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <p className="text-sm">Start typing your task above to see how Concord extracts fields in real time...</p>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2 text-sm">
                        <div className="p-3 bg-background/80 rounded-xl border border-border/40">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">Extracted Title</span>
                          <span className="font-medium text-foreground">{editedSingleTitle || input}</span>
                        </div>
                        <div className="p-3 bg-background/80 rounded-xl border border-border/40 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Priority</span>
                          <Badge className={cn("capitalize", PRIORITY_COLORS[editedSinglePriority])}>
                            {editedSinglePriority}
                          </Badge>
                        </div>
                        <div className="p-3 bg-background/80 rounded-xl border border-border/40 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Category</span>
                          <Badge variant="outline">{editedSingleCategory}</Badge>
                        </div>
                        {editedSingleDate && (
                          <div className="p-3 bg-background/80 rounded-xl border border-border/40 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Date</span>
                            <span className="text-xs font-mono">{editedSingleDate}</span>
                          </div>
                        )}
                        {extractedMood && (
                          <div className="p-3 bg-background/80 rounded-xl border border-border/40 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Extracted Mood</span>
                            <Badge variant="secondary" className="capitalize">
                              {extractedMood.label} (Energy: {extractedMood.energy})
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* MULTI TASK CHAINED CARDS */}
          {isMultiMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-base">
                  {multiParsing ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Splitting chained tasks...
                    </span>
                  ) : (
                    <span>{editableTasks.length} chained tasks detected</span>
                  )}
                </h2>
              </div>

              {editableTasks.map((t, idx) => (
                <Card key={idx} className="p-5 border-border/60 shadow-sm space-y-4 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Task {idx + 1}
                    </span>
                    <button
                      onClick={() => removeTask(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Task Title</Label>
                    <Input
                      value={t.localTitle}
                      onChange={(e) => updateField(idx, "localTitle", e.target.value)}
                      className="rounded-xl border-border/60"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Priority</Label>
                      <Select
                        value={t.localPriority}
                        onValueChange={(v) => updateField(idx, "localPriority", v as any)}
                      >
                        <SelectTrigger className={cn("h-9 text-xs rounded-xl border", PRIORITY_COLORS[t.localPriority])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">🔴 High</SelectItem>
                          <SelectItem value="medium">🟡 Medium</SelectItem>
                          <SelectItem value="low">🟢 Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Category</Label>
                      <Select
                        value={t.localCategory}
                        onValueChange={(v) => updateField(idx, "localCategory", v)}
                      >
                        <SelectTrigger className="h-9 text-xs rounded-xl border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Deadline</Label>
                      <Input
                        type="date"
                        value={t.localDeadline}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => updateField(idx, "localDeadline", e.target.value)}
                        className="h-9 text-xs rounded-xl border-border/60"
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {editableTasks.length > 0 && (
                <div className="flex justify-end pt-2">
                  <Button
                    size="lg"
                    onClick={handleSaveAIMulti}
                    disabled={savingAll || editableTasks.every((t) => !t.localTitle.trim())}
                    className="rounded-full px-8 shadow-md"
                  >
                    {savingAll ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5 mr-2" />
                    )}
                    Save {editableTasks.length} Tasks
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODE B: MANUAL TASK ENTRY FORM ────────────────────────────────────── */}
      {mode === "manual" && (
        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-lg font-serif font-medium flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              Manual Task Creation Form
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Warnings (Duplicate & Conflict checks) */}
            {manualWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1 text-xs">
                {manualWarning.duplicate && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>A task with this name is already scheduled on this day.</span>
                  </div>
                )}
                {manualWarning.conflict && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Conflict: Overlaps with task <strong>"{manualWarning.conflictTitle}"</strong> at {manualTime}.</span>
                  </div>
                )}
              </div>
            )}

            {/* Task Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Task Name *</Label>
                <span className="text-xs text-muted-foreground">{manualTitle.length} / 150</span>
              </div>
              <Input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value.slice(0, 150))}
                placeholder="e.g. Call client regarding project update"
                className="rounded-xl border-border/60 text-base"
                autoFocus
              />
            </div>

            {/* Category & Priority Row */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Category</Label>
                <Select value={manualCategory} onValueChange={setManualCategory}>
                  <SelectTrigger className="rounded-xl border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {manualCategory === "Custom" && (
                  <Input
                    value={manualCustomCategory}
                    onChange={(e) => setManualCustomCategory(e.target.value.slice(0, 50))}
                    placeholder="Enter custom category name..."
                    className="mt-2 rounded-xl border-border/60 text-sm"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Priority</Label>
                <Select value={manualPriority} onValueChange={(v) => setManualPriority(v as any)}>
                  <SelectTrigger className={cn("rounded-xl border font-medium", PRIORITY_COLORS[manualPriority])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 High Priority</SelectItem>
                    <SelectItem value="medium">🟡 Medium Priority</SelectItem>
                    <SelectItem value="low">🟢 Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date, Time, Deadline Row */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" /> Scheduled Date *
                </Label>
                <Input
                  type="date"
                  value={manualDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="rounded-xl border-border/60"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> Scheduled Time
                </Label>
                <Input
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="rounded-xl border-border/60"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-500" /> Deadline Date
                </Label>
                <Input
                  type="date"
                  value={manualDeadline}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setManualDeadline(e.target.value)}
                  className="rounded-xl border-border/60"
                />
              </div>
            </div>

            {/* Duration & Reminder Row */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Duration (Minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  placeholder="30"
                  className="rounded-xl border-border/60"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Reminder</Label>
                <Select value={manualReminder} onValueChange={setManualReminder}>
                  <SelectTrigger className="rounded-xl border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="5m">5 Minutes Before</SelectItem>
                    <SelectItem value="15m">15 Minutes Before</SelectItem>
                    <SelectItem value="30m">30 Minutes Before</SelectItem>
                    <SelectItem value="1h">1 Hour Before</SelectItem>
                    <SelectItem value="1d">1 Day Before</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">How are you feeling?</Label>
                <Select value={manualMood} onValueChange={(v: any) => setManualMood(v)}>
                  <SelectTrigger className="rounded-xl border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">😐 Neutral</SelectItem>
                    <SelectItem value="happy">😊 Happy / Energetic</SelectItem>
                    <SelectItem value="stressed">😰 Stressed / Anxious</SelectItem>
                    <SelectItem value="tired">🥱 Tired / Sleepy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description / Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-muted-foreground" /> Notes / Description
              </Label>
              <Textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value.slice(0, 1000))}
                placeholder="Additional notes, instructions or references..."
                className="min-h-[100px] rounded-xl border-border/60 resize-none"
              />
            </div>

            {/* Form Save Button */}
            <div className="pt-4 flex justify-end gap-3 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/tasks")}
                className="rounded-full px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={handleSaveManual}
                disabled={!manualTitle.trim()}
                className="rounded-full px-8 shadow-md"
              >
                <Check className="w-5 h-5 mr-2" />
                Save Manual Task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Confirm Task Details</DialogTitle>
            <DialogDescription>
              Please review the parsed task parameters before saving:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Task Name:</span>
              <span className="font-semibold text-foreground">{editedSingleTitle}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Date:</span>
              <span className="font-semibold text-foreground">{editedSingleDate}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Scheduled Time:</span>
              <span className="font-semibold text-foreground">{editedSingleTime || "00:00 (Today Night)"}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Duration:</span>
              <span className="font-semibold text-foreground">{editedSingleDuration} minutes</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Priority:</span>
              <span className="font-semibold capitalize text-foreground">{editedSinglePriority}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Category:</span>
              <span className="font-semibold text-foreground">{editedSingleCategory}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium">Deadline:</span>
              <span className="font-semibold text-foreground">{editedSingleDeadline || "None"}</span>
            </div>
            {(parseTask.data as any)?.recurrence && (
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground font-medium">Recurrence:</span>
                <span className="font-semibold text-foreground">{(parseTask.data as any).recurrence}</span>
              </div>
            )}
            {(parseTask.data as any)?.dependencies && (parseTask.data as any).dependencies.length > 0 && (
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground font-medium">Dependencies:</span>
                <span className="font-semibold text-foreground">{(parseTask.data as any).dependencies.join(", ")}</span>
              </div>
            )}
            {(parseTask.data as any)?.reminder && (
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground font-medium">Reminder:</span>
                <span className="font-semibold text-foreground capitalize">{(parseTask.data as any).reminder.replace(/_/g, " ")}</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>
              Go Back & Edit
            </Button>
            <Button onClick={() => { setShowSaveConfirm(false); executeSaveSingle(); }}>
              Confirm & Save Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekend Availability Confirmation Dialog */}
      <Dialog open={showWeekendConfirm} onOpenChange={setShowWeekendConfirm}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> Weekend Holiday Work Check
            </DialogTitle>
            <DialogDescription>
              The selected date falls on a weekend holiday (2nd/4th Saturday or Sunday). Are you available to work on weekends?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowWeekendConfirm(false); setPendingSaveAction(null); }}>
              No, Keep Holiday
            </Button>
            <Button 
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={async () => {
                setShowWeekendConfirm(false);
                try {
                  await updateProfile({ weekendAvailable: true });
                  toast({ title: "Weekend work enabled 👍" });
                } catch {
                  console.warn("Could not save availability to backend, proceeding with local task save.");
                }
                if (pendingSaveAction) {
                  pendingSaveAction();
                  setPendingSaveAction(null);
                }
              }}
            >
              Yes, I am available
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
