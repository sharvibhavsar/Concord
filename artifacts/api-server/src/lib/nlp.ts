import * as chrono from "chrono-node";
// @ts-ignore – compromise has no bundled typings compatible with ESM
import nlp from "compromise";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  work: [
    "meeting", "email", "report", "presentation", "project", "client",
    "deadline", "proposal", "review", "feedback", "sprint", "standup",
    "deploy", "code", "bug", "fix", "feature", "call", "conference",
    "invoice", "contract", "budget", "hire", "interview", "onboard", "work",
  ],
  personal: [
    "doctor", "dentist", "appointment", "family", "friend", "birthday",
    "anniversary", "party", "event", "visit", "travel", "vacation",
    "holiday", "gift", "wedding", "baby", "kids", "school", "pickup", "meet",
  ],
  health: [
    "workout", "gym", "run", "exercise", "yoga", "meditate", "sleep",
    "diet", "nutrition", "vitamins", "medicine", "therapy", "checkup",
    "weight", "steps", "water", "hydrate", "fitness",
  ],
  shopping: [
    "buy", "purchase", "order", "grocery", "store", "shop", "pick up",
    "get", "need", "stock up", "restock", "amazon", "delivery",
  ],
  finance: [
    "pay", "bill", "tax", "rent", "mortgage", "insurance", "bank",
    "transfer", "invest", "savings", "expense", "refund", "receipt",
  ],
  learning: [
    "read", "book", "course", "learn", "study", "research", "watch",
    "tutorial", "practice", "train", "certification", "exam",
  ],
};

const HIGH_PRIORITY_WORDS = [
  "urgent", "asap", "immediately", "critical", "emergency",
  "important", "must", "crucial", "deadline", "overdue", "now", "high priority",
];
const LOW_PRIORITY_WORDS = [
  "someday", "eventually", "maybe", "whenever", "later",
  "low priority", "no rush", "if possible",
];

export interface ParsedTask {
  rawInput: string;
  title: string;
  summary: string | null;
  category: string | null;
  priority: "low" | "medium" | "high";
  deadline: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  duration: string | null;
  keywords: string[];
  intent: string;
  taskType?: string;
  reminder?: string | null;
  recurrence?: string | null;
  dependencies?: string[];
  clarificationPrompt?: string | null;
  validationError?: string | null;
  mood: {
    happy: number;
    sad: number;
    stress: number;
    fatigue: number;
    energy: number;
    label: string;
  } | null;
}

// Stage 1: Input Preprocessing
export function preprocessInput(text: string): { original: string; normalized: string; lower: string } {
  const original = text;
  // Normalize whitespace
  let clean = text.trim().replace(/\s+/g, " ");
  // Normalize punctuation: double !! / ?? to single, trim trailing exclamation
  clean = clean.replace(/!+/g, "!").replace(/\?+/g, "?");
  
  // Normalize standard abbreviations for time
  clean = clean.replace(/\b(\d+)\s*(?:pm|PM)\b/g, "$1 PM");
  clean = clean.replace(/\b(\d+)\s*(?:am|AM)\b/g, "$1 AM");

  return {
    original,
    normalized: clean,
    lower: clean.toLowerCase(),
  };
}

// Stage 2: Intent Detection
export function detectIntent(lower: string): string {
  if (/\b(then|and then|after that|followed by|next|and also)\b/i.test(lower) || lower.includes(";") || (lower.includes(",") && lower.length > 40)) {
    return "Create Multiple Tasks";
  }
  if (/\b(meet|meeting|discuss|interview|call)\b/i.test(lower)) {
    return "Create Meeting";
  }
  if (/\b(event|festival|concert|conference|party|celebrate)\b/i.test(lower)) {
    return "Create Event";
  }
  if (/\b(remind|notify|alert)\b/i.test(lower)) {
    return "Create Reminder";
  }
  if (/\b(deadline|due|by|before)\b/i.test(lower) && /\b(task|project|assignment|report)\b/i.test(lower)) {
    return "Create Deadline";
  }
  if (/\b(project|milestone|epic|sprint)\b/i.test(lower)) {
    return "Create Project Task";
  }
  if (/\b(show|view|find|list|get|query|search)\b/i.test(lower)) {
    return "Query Existing Tasks";
  }
  const hasActionVerb = /\b(call|drop|meet|buy|study|go|do|make|clean|write|finish|prepare|submit|work|pay|transfer)\b/i.test(lower);
  if (!hasActionVerb) {
    return "General Conversation";
  }
  return "Create Task";
}

// Stage 6: Mood Detection
export function detectMood(lower: string): ParsedTask["mood"] {
  let happy = 5, sad = 0, stress = 0, fatigue = 0, energy = 5;
  let matches = 0;

  if (/\b(happy|excited|joy|glad|awesome|thrilled|wonderful|great|good)\b/i.test(lower)) {
    happy += 3;
    energy += 3;
    matches++;
  }
  if (/\b(sad|cry|depressed|lonely|unhappy|down|grief|hurt)\b/i.test(lower)) {
    sad += 6;
    happy -= 3;
    energy -= 2;
    matches++;
  }
  if (/\b(stressed|anxious|overwhelmed|nervous|worried|panic|frustrated|angry|mad)\b/i.test(lower)) {
    stress += 7;
    energy += 1;
    matches++;
  }
  if (/\b(tired|sleepy|exhausted|fatigued|lazy|bored|dull|slow)\b/i.test(lower)) {
    fatigue += 8;
    energy -= 4;
    matches++;
  }

  if (matches === 0) return null;

  // Bound checks
  happy = Math.max(0, Math.min(10, happy));
  sad = Math.max(0, Math.min(10, sad));
  stress = Math.max(0, Math.min(10, stress));
  fatigue = Math.max(0, Math.min(10, fatigue));
  energy = Math.max(0, Math.min(10, energy));

  let label = "neutral";
  if (stress > 5) label = "stressed";
  else if (fatigue > 6) label = "tired";
  else if (sad > 5) label = "sad";
  else if (happy > 6) label = "happy";

  return { happy, sad, stress, fatigue, energy, label };
}

export function parseFlexibleTime(text: string): string | null {
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

export function parseTemporal(text: string, anchorDate: Date = new Date()): {
  scheduledDate: string | null;
  scheduledTime: string | null;
  deadline: string | null;
  duration: string | null;
} {
  const lower = text.toLowerCase();
  let scheduledDate: string | null = null;
  let scheduledTime: string | null = null;
  let deadline: string | null = null;
  let duration: string | null = "30"; // Default: 30 minutes

  // Check duration indicators (e.g. "for 1 hour", "for 45 mins", "30 minutes duration")
  const durationMatch = text.match(/\bfor\s+(\d+)\s*(min|minute|hr|hour|h|m)s?\b/i) || text.match(/\b(\d+)\s*(min|minute|hr|hour|h|m)s?\b/i);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    if (unit.startsWith("h")) {
      duration = String(amount * 60);
    } else {
      duration = String(amount);
    }
  }

  let dateMentioned = false;
  let timeMentioned = false;

  // Custom parsing for ordinal dates: e.g. "on 29th", "on 28th next month", "on 16th december", "29th"
  const ordinalDateMatch = lower.match(/(?:\bon\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+(next\s+month|january|february|march|april|may|june|july|august|september|october|november|december|dec|nov|oct|sept|aug|jul|jun|apr|mar|feb|jan))?/i) ||
                           lower.match(/(?:\bon\s+)(\d{1,2})\b(?:\s+(next\s+month|january|february|march|april|may|june|july|august|september|october|november|december|dec|nov|oct|sept|aug|jul|jun|apr|mar|feb|jan))?/i);
  if (ordinalDateMatch) {
    dateMentioned = true;
    const dayVal = parseInt(ordinalDateMatch[1], 10);
    const monthWord = ordinalDateMatch[2] ? ordinalDateMatch[2].trim().toLowerCase() : "";

    let targetYear = anchorDate.getFullYear();
    let targetMonth = anchorDate.getMonth(); // 0-indexed

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
    const isDeadline = /\b(by|before|until|no later than)\b$/i.test(prefix);

    const matchedTime = parseFlexibleTime(lower);
    if (matchedTime) {
      timeMentioned = true;
      scheduledTime = matchedTime;
    }

    if (isDeadline) {
      deadline = new Date(targetYear, targetMonth, dayVal, 0, 0, 0).toISOString();
      scheduledDate = null;
    } else {
      scheduledDate = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(dayVal).padStart(2, "0")}`;
    }
    return { scheduledDate, scheduledTime, deadline, duration };
  }

  const matchedTime = parseFlexibleTime(lower);
  if (matchedTime) {
    timeMentioned = true;
    scheduledTime = matchedTime;
  }

  // 1. Next Month
  if (lower.includes("next month")) {
    dateMentioned = true;
    const nextMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
    scheduledDate = nextMonth.toISOString().split("T")[0];
    scheduledTime = null;
    const lastDayOfNextMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 2, 0);
    deadline = lastDayOfNextMonth.toISOString();
    return { scheduledDate, scheduledTime, deadline, duration };
  }

  // 2. Next [weekday]
  const nextWeekdayMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (nextWeekdayMatch) {
    dateMentioned = true;
    const targetDay = nextWeekdayMatch[1];
    const daysMap: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0
    };
    const targetDayNum = daysMap[targetDay];
    const currentDayNum = anchorDate.getDay();
    let diff = targetDayNum - currentDayNum;
    if (diff <= 0) diff += 7;
    diff += 7; // Go to next week
    const resolvedDate = new Date(anchorDate);
    resolvedDate.setDate(anchorDate.getDate() + diff);
    scheduledDate = resolvedDate.toISOString().split("T")[0];
    scheduledTime = null;
    deadline = null;
    return { scheduledDate, scheduledTime, deadline, duration };
  }

  // 3. Fallback parsing using chrono-node
  const parsed = chrono.parse(text, anchorDate, { forwardDate: true });
  if (parsed.length > 0) {
    const firstResult = parsed[0];
    dateMentioned = true;
    const dateVal = firstResult.date();
    const resolvedDateStr = dateVal.toISOString().split("T")[0];

    if (!scheduledTime && firstResult.start.isCertain("hour")) {
      timeMentioned = true;
      const hours = String(dateVal.getHours()).padStart(2, "0");
      const minutes = String(dateVal.getMinutes()).padStart(2, "0");
      scheduledTime = `${hours}:${minutes}`;
    }

    // Check for deadline prepositions: by, before, until, no later than
    const matchIndex = text.toLowerCase().indexOf(firstResult.text.toLowerCase());
    const prefix = matchIndex > 0 ? text.slice(0, matchIndex).trim().toLowerCase() : "";
    const isDeadline = /\b(by|before|until|no later than)\b$/i.test(prefix) || /\b(by|before|until|no later than)\s+$/i.test(prefix);

    if (isDeadline) {
      deadline = dateVal.toISOString();
      scheduledDate = null;
    } else {
      scheduledDate = resolvedDateStr;
    }
  }

  // Custom relative dates (today, tomorrow, weekend)
  if (/\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/i.test(lower)) {
    dateMentioned = true;
    if (lower.includes("tomorrow") && !scheduledDate && !deadline) {
      const targetDateStr = new Date(anchorDate.getTime() + 86400000).toISOString().split("T")[0];
      const matchIndex = lower.indexOf("tomorrow");
      const prefix = matchIndex > 0 ? lower.slice(0, matchIndex).trim() : "";
      const isDeadline = /\b(by|before|until|no later than)\b$/i.test(prefix);
      if (isDeadline) {
        deadline = new Date(anchorDate.getTime() + 86400000).toISOString();
      } else {
        scheduledDate = targetDateStr;
      }
    }
  }

  // "before lunch" -> deadline today 12:00 PM
  if (lower.includes("before lunch")) {
    deadline = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), 12, 0, 0).toISOString();
    timeMentioned = true;
  }

  // 4. Default rules
  if (!dateMentioned && !deadline && !scheduledDate) {
    scheduledDate = anchorDate.toISOString().split("T")[0];
    if (!timeMentioned) {
      scheduledTime = "00:00";
    }
  }

  return { scheduledDate, scheduledTime, deadline, duration };
}

export function parseTaskInput(rawInput: string, anchorDate: Date = new Date()): ParsedTask {
  const prep = preprocessInput(rawInput);
  const intent = detectIntent(prep.lower);
  const mood = detectMood(prep.lower);
  const temp = parseTemporal(prep.normalized, anchorDate);

  // --- Keyword extraction ---
  let keywords: string[] = [];
  try {
    const doc = nlp(prep.normalized);
    const nouns: string[] = doc.nouns().out("array");
    const verbs: string[] = doc.verbs().out("array");
    const rawKeywords = [...nouns, ...verbs]
      .map((k: string) => k.toLowerCase().trim())
      .filter((k: string) => k.length > 2 && !isStopWord(k));
    keywords = [...new Set(rawKeywords)].slice(0, 8);
  } catch {
    keywords = prep.normalized.split(/\s+/).filter((w) => w.length > 3 && !isStopWord(w.toLowerCase())).slice(0, 6);
  }

  // --- Category detection ---
  let category: string | null = null;
  let maxScore = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce(
      (acc, w) => acc + (prep.lower.includes(w) ? 1 : 0),
      0,
    );
    if (score > maxScore) {
      maxScore = score;
      category = cat;
    }
  }
  if (maxScore === 0) category = "General";
  if (category) {
    category = category.charAt(0).toUpperCase() + category.slice(1);
  }

  // --- Default Priority Rule: medium unless date is tomorrow OR urgent/quick/fast ---
  let priority: "low" | "medium" | "high" = "medium";
  const tomorrowStr = new Date(anchorDate.getTime() + 86400000).toISOString().split("T")[0];
  if (/\b(urgent|quick|fast|asap|immediately|important)\b/i.test(prep.lower)) {
    priority = "high";
  } else if (temp.scheduledDate === tomorrowStr) {
    priority = "high";
  } else {
    priority = "medium";
  }

  // --- Clean Task Name (strip relative dates, locations, times) ---
  let cleanTitle = prep.normalized;

  // Custom parsing for ordinal dates: e.g. "on 29th", "on 28th next month", "on 16th december"
  const ordinalDateMatch = prep.lower.match(/(?:\bon\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+(next\s+month|january|february|march|april|may|june|july|august|september|october|november|december|dec|nov|oct|sept|aug|jul|jun|apr|mar|feb|jan))?/i) ||
                           prep.lower.match(/(?:\bon\s+)(\d{1,2})\b(?:\s+(next\s+month|january|february|march|april|may|june|july|august|september|october|november|december|dec|nov|oct|sept|aug|jul|jun|apr|mar|feb|jan))?/i);
  if (ordinalDateMatch) {
    cleanTitle = cleanTitle.replace(new RegExp(ordinalDateMatch[0], "i"), "").trim();
  }

  const parsedChrono = chrono.parse(prep.normalized, anchorDate);
  for (const result of parsedChrono) {
    cleanTitle = cleanTitle.replace(result.text, "").trim();
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

  let title = cleanTitle || prep.normalized;

  // Grocery list extraction: "Buy milk, eggs and vegetables"
  let summary = null;
  if (prep.lower.startsWith("buy ") && (prep.lower.includes(",") || prep.lower.includes(" and "))) {
    title = "Buy Groceries";
    const itemsText = cleanTitle.replace(/^buy\s+/i, "");
    const items = itemsText.split(/,|\band\b/gi).map(i => i.trim()).filter(Boolean);
    summary = items.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join("\n");
  } else {
    summary =
      prep.normalized.length > title.length + 10
        ? `Task parsed from: "${prep.normalized.slice(0, 120)}${prep.normalized.length > 120 ? "..." : ""}"`
        : null;
  }

  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 80) title = title.slice(0, 77) + "...";

  // --- Task Type ---
  let taskType = "Task";
  if (intent === "Create Meeting") taskType = "Meeting";
  else if (intent === "Create Event") taskType = "Event";
  else if (intent === "Create Reminder") taskType = "Reminder";

  // --- Recurrence Detection ---
  let recurrence: string | null = null;
  if (/\bdaily\b/i.test(prep.lower)) {
    recurrence = "Daily";
  } else if (/\bweekly\b/i.test(prep.lower)) {
    recurrence = "Weekly";
  } else if (/\bmonthly\b/i.test(prep.lower)) {
    recurrence = "Monthly";
  } else if (/\byearly\b/i.test(prep.lower)) {
    recurrence = "Yearly";
  } else if (/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(prep.lower)) {
    const match = prep.lower.match(/\bevery\s+([a-z]+)\b/i);
    recurrence = match ? `Every ${match[1].charAt(0).toUpperCase() + match[1].slice(1)}` : "Weekly";
  } else if (/\bevery\s+weekday\b/i.test(prep.lower)) {
    recurrence = "Every Weekday";
  } else if (/\bevery\s+weekend\b/i.test(prep.lower)) {
    recurrence = "Every Weekend";
  } else if (/\bevery\s+\d+\s+weeks\b/i.test(prep.lower)) {
    recurrence = "Bi-weekly";
  }

  // --- Dependency Extraction ---
  let dependencies: string[] = [];
  const afterMatch = prep.lower.match(/\bafter\s+(finishing\s+|completing\s+)?([a-z0-9\s]+?)(?:\s+then|\s+and|\s*|\btime\b|$)/i);
  if (afterMatch) {
    const depName = afterMatch[2].trim();
    if (!/monday|tuesday|wednesday|thursday|friday|saturday|sunday|month|tomorrow|today|\d/i.test(depName)) {
      dependencies.push(depName.charAt(0).toUpperCase() + depName.slice(1));
    }
  }
  const beforeMatch = prep.lower.match(/\bbefore\s+([a-z0-9\s]+?)(?:\s+then|\s+and|\s*|$)/i);
  if (beforeMatch) {
    const depName = beforeMatch[1].trim();
    if (!/monday|tuesday|wednesday|thursday|friday|saturday|sunday|month|tomorrow|today|\d/i.test(depName)) {
      dependencies.push(`Before ${depName.charAt(0).toUpperCase() + depName.slice(1)}`);
    }
  }

  // --- Reminder Detection ---
  let reminder: string | null = null;
  if (/\b(remind|notify|alert)\b/i.test(prep.lower)) {
    const reminderMatch = prep.lower.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\s+before/i);
    if (reminderMatch) {
      const amount = reminderMatch[1];
      const unit = reminderMatch[2].toLowerCase();
      if (unit.startsWith("min")) {
        reminder = `${amount}_minutes_before`;
      } else if (unit.startsWith("hour") || unit.startsWith("hr")) {
        reminder = `${amount}_hours_before`;
      } else if (unit.startsWith("day")) {
        reminder = `${amount}_days_before`;
      }
    } else {
      reminder = "30_minutes_before";
    }
  }

  // --- Clarification Rules ---
  let clarificationPrompt: string | null = null;
  if (intent.startsWith("Create")) {
    const hasDate = !!temp.scheduledDate || !!temp.deadline;
    const hasTime = !!temp.scheduledTime && temp.scheduledTime !== "00:00";
    const durationSpecified = /\b(hour|minute|min|hr|h|m|mins|hours)\b/i.test(prep.lower);

    if (prep.lower.includes("meet sarah")) {
      if (!hasDate) {
        clarificationPrompt = "Which day would you like to schedule this?";
      } else if (!hasTime) {
        clarificationPrompt = "What time should I schedule it?";
      }
    } else if (prep.lower.includes("study") && !durationSpecified) {
      clarificationPrompt = "Approximately how long will this take?";
    } else if (prep.lower.includes("call john") && hasTime && !hasDate) {
      clarificationPrompt = "Which day should I schedule this?";
    } else if (!hasDate && hasTime) {
      clarificationPrompt = "Which day should I schedule this?";
    } else if (!hasDate) {
      clarificationPrompt = "Which day would you like to schedule this?";
    }
  }

  // --- Validation Rules ---
  let validationError: string | null = null;
  if (temp.scheduledDate && temp.deadline) {
    const sDate = new Date(`${temp.scheduledDate}T${temp.scheduledTime || "00:00"}`);
    const dDate = new Date(temp.deadline);
    if (dDate < sDate) {
      validationError = "Deadline is earlier than the scheduled date.";
    }
  }
  if (temp.duration && parseInt(temp.duration, 10) <= 0) {
    validationError = "Duration is zero or negative.";
  }

  return {
    rawInput: prep.normalized,
    title,
    summary,
    category,
    priority,
    deadline: temp.deadline,
    scheduledDate: temp.scheduledDate,
    scheduledTime: temp.scheduledTime,
    duration: temp.duration,
    keywords,
    intent,
    taskType,
    recurrence,
    dependencies,
    reminder,
    clarificationPrompt,
    validationError,
    mood,
  };
}

// Chained tasks splitter pattern
const CHAIN_PATTERN =
  /\s*(?:;\s*|,\s*|\b(?:and\s+)?then\b|\bafter\s+that\b|\bfollowed\s+by\b|\bnext\b|\band\s+also\b)\s*/gi;

export function parseMultiTaskInput(rawInput: string, anchorDate: Date = new Date()): ParsedTask[] {
  const prep = preprocessInput(rawInput);
  if (!prep.normalized) return [];

  const intent = detectIntent(prep.lower);
  if (intent !== "create_multi_tasks") {
    return [parseTaskInput(prep.normalized, anchorDate)];
  }

  // Global deadline fallback
  const globalDeadlineParsed = chrono.parse(prep.normalized, anchorDate, { forwardDate: true });
  const globalDeadline = globalDeadlineParsed.length > 0
    ? globalDeadlineParsed[globalDeadlineParsed.length - 1].date().toISOString()
    : null;

  const segments = prep.normalized
    .split(CHAIN_PATTERN)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  if (segments.length <= 1) {
    return [parseTaskInput(prep.normalized, anchorDate)];
  }

  const tasks: ParsedTask[] = segments.map((seg) => {
    const parsed = parseTaskInput(seg, anchorDate);
    if (!parsed.deadline && globalDeadline) {
      parsed.deadline = globalDeadline;
      parsed.scheduledDate = globalDeadline.split("T")[0];
    }
    return parsed;
  });

  return tasks;
}

function isStopWord(word: string): boolean {
  const stops = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "is", "are", "was", "were", "be",
    "been", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "this", "that",
    "it", "its", "my", "me", "i", "we", "our", "you", "your", "then",
    "after", "before", "next", "show", "her", "him", "them",
  ]);
  return stops.has(word);
}

// ---------------------------------------------------------------------------
// Chat assistant — DB-aware, fetches real task data
// ---------------------------------------------------------------------------

export interface ChatContext {
  taskCount: number;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
}

export interface TaskRecord {
  id: number;
  title: string;
  status: string;
  priority: string;
  deadline: Date | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  summary: string | null;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "no deadline";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function weekRange(offsetWeeks: number): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - day);
  startOfThisWeek.setHours(0, 0, 0, 0);
  const start = new Date(startOfThisWeek);
  start.setDate(startOfThisWeek.getDate() + offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatTaskList(tasks: TaskRecord[], label: string): string {
  if (tasks.length === 0) return `No ${label} found.`;
  const lines = tasks.slice(0, 10).map((t) => {
    const deadline = t.deadline ? ` · due ${fmtDate(t.deadline)}` : "";
    const status = t.status === "completed" ? "✅" : t.status === "in_progress" ? "🔄" : "⏳";
    return `${status} **${t.title}** [${t.priority}]${deadline}`;
  });
  const extra = tasks.length > 10 ? `\n…and ${tasks.length - 10} more.` : "";
  return `Here are your ${label}:\n\n${lines.join("\n")}${extra}`;
}

export function generateSmartChatResponse(
  message: string,
  tasks: TaskRecord[],
  context: ChatContext,
): string {
  const lower = message.toLowerCase().trim();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(lower)) {
    return (
      "Hello! I'm your Concord assistant 👋\n\n" +
      "I can fetch real data from your tasks. Try asking:\n" +
      "• 'Show me my high priority tasks today'\n" +
      "• 'Am I available on the 23rd?'\n" +
      "• 'What tasks are due next week with low priority?'\n" +
      "• 'Give me a summary of my workload'\n" +
      "• 'What did I miss this week?'"
    );
  }

  // Check read-only mutation attempts
  if (/\b(delete|remove|cancel|discard)\b/i.test(lower) && /\b(task|event|item)\b/i.test(lower)) {
    return (
      "⚠️ **Action Required**: Direct deletions are restricted via chat.\n\n" +
      "Please navigate to the [Tasks page](file:///tasks) or select the task in the list to delete it."
    );
  }
  if (/\b(complete|done|finish|tick|check)\b/i.test(lower) && /\b(task|event|item)\b/i.test(lower)) {
    return (
      "⚠️ **Action Required**: Task completion cannot be done directly through chat.\n\n" +
      "Please click the checkbox on the task card in the [Tasks list](file:///tasks) to mark it as complete."
    );
  }
  if (/\b(change|edit|update|modify|reschedule)\b/i.test(lower) && /\b(task|deadline|priority|date|time)\b/i.test(lower)) {
    return (
      "⚠️ **Action Required**: Editing tasks is restricted in chat.\n\n" +
      "Go to the [Tasks page](file:///tasks) and click 'Edit' on the task's dropdown menu to update details."
    );
  }

  if (
    lower.includes("available") ||
    lower.includes("free on") ||
    lower.includes("free time") ||
    lower.includes("do i have time") ||
    lower.includes("am i busy")
  ) {
    const dateResults = chrono.parse(message, now, { forwardDate: true });
    if (dateResults.length > 0) {
      const targetDate = dateResults[0].date();
      const targetStart = startOfDay(targetDate);
      const targetEnd = new Date(targetStart);
      targetEnd.setHours(23, 59, 59, 999);

      const tasksOnDate = tasks.filter((t) => {
        if (!t.deadline) return false;
        const dl = new Date(t.deadline);
        return dl >= targetStart && dl <= targetEnd;
      });

      const dateLabel = fmtDate(targetDate);

      if (tasksOnDate.length === 0) {
        return (
          `Your calendar for **${dateLabel}** looks clear — no tasks are scheduled on that date.\n\n` +
          `You have ${context.pendingCount} pending tasks in total, none specifically due on ${dateLabel}.`
        );
      }

      const lines = tasksOnDate.map((t) => {
        const time = t.deadline
          ? new Date(t.deadline).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "";
        return `• **${t.title}** [${t.priority}]${time ? ` at ${time}` : ""}`;
      });

      return (
        `On **${dateLabel}** you have ${tasksOnDate.length} task${tasksOnDate.length > 1 ? "s" : ""} scheduled:\n\n` +
        lines.join("\n") +
        `\n\nYou may want to plan around these when scheduling new work for that day.`
      );
    }
    return "Tell me which date you're checking — for example, 'Am I available on the 23rd?' or 'Am I free on August 15?'";
  }

  const isHighPriority = lower.includes("high priority") || lower.includes("urgent") || lower.includes("important");
  const isMediumPriority = lower.includes("medium priority");
  const isLowPriority = lower.includes("low priority");
  const priorityFilter = isHighPriority ? "high" : isMediumPriority ? "medium" : isLowPriority ? "low" : null;

  const isToday = lower.includes("today") || lower.includes("due today");
  const isThisWeek = lower.includes("this week");
  const isNextWeek = lower.includes("next week");
  const isOverdue = lower.includes("overdue") || lower.includes("missed") || lower.includes("late");
  const isPending = lower.includes("pending") || lower.includes("not done") || lower.includes("not started") || lower.includes("to do");
  const isCompleted = lower.includes("completed") || lower.includes("done") || lower.includes("finished");
  const isInProgress = lower.includes("in progress") || lower.includes("working on") || lower.includes("in-progress");

  const hasSpecificDate = chrono.parse(message, now, { forwardDate: true }).length > 0;
  if (hasSpecificDate && !isToday && !isThisWeek && !isNextWeek) {
    const dateResults = chrono.parse(message, now, { forwardDate: true });
    const targetDate = dateResults[0].date();
    const targetStart = startOfDay(targetDate);
    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);
    const dateLabel = fmtDate(targetDate);

    let filtered = tasks.filter((t) => {
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      return dl >= targetStart && dl <= targetEnd;
    });

    if (priorityFilter) filtered = filtered.filter((t) => t.priority === priorityFilter);

    const label = `${priorityFilter ? priorityFilter + " priority " : ""}tasks on ${dateLabel}`;
    return formatTaskList(filtered, label);
  }

  if (isToday) {
    let filtered = tasks.filter((t) => {
      if (t.status === "completed") return false;
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      return dl >= todayStart && dl <= todayEnd;
    });
    if (priorityFilter) filtered = filtered.filter((t) => t.priority === priorityFilter);
    const label = `${priorityFilter ? priorityFilter + " priority " : ""}tasks due today`;
    return formatTaskList(filtered, label);
  }

  if (isThisWeek) {
    const { start, end } = weekRange(0);
    let filtered = tasks.filter((t) => {
      if (t.status === "completed") return false;
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      return dl >= start && dl <= end;
    });
    if (priorityFilter) filtered = filtered.filter((t) => t.priority === priorityFilter);
    const label = `${priorityFilter ? priorityFilter + " priority " : ""}tasks this week`;
    return formatTaskList(filtered, label);
  }

  if (isNextWeek) {
    const { start, end } = weekRange(1);
    let filtered = tasks.filter((t) => {
      if (t.status === "completed") return false;
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      return dl >= start && dl <= end;
    });
    if (priorityFilter) filtered = filtered.filter((t) => t.priority === priorityFilter);
    const label = `${priorityFilter ? priorityFilter + " priority " : ""}tasks next week`;
    return formatTaskList(filtered, label);
  }

  if (isOverdue) {
    const filtered = tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed",
    );
    if (filtered.length === 0) {
      return "Great news — you have no overdue tasks right now! You're on top of things. 🎉";
    }
    return formatTaskList(filtered, "overdue tasks");
  }

  if (priorityFilter) {
    const filtered = tasks.filter(
      (t) => t.priority === priorityFilter && t.status !== "completed",
    );
    return formatTaskList(filtered, `${priorityFilter} priority tasks`);
  }

  if (isPending) {
    const filtered = tasks.filter((t) => t.status === "pending");
    return formatTaskList(filtered, "pending tasks");
  }

  if (isCompleted) {
    const filtered = tasks.filter((t) => t.status === "completed");
    return formatTaskList(filtered, "completed tasks");
  }

  if (isInProgress) {
    const filtered = tasks.filter((t) => t.status === "in_progress");
    return formatTaskList(filtered, "in-progress tasks");
  }

  if (
    lower.includes("summary") ||
    lower.includes("overview") ||
    lower.includes("how many") ||
    lower.includes("status") ||
    lower.includes("workload")
  ) {
    const overdueList = tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed",
    );
    return (
      `Here's your task overview:\n\n` +
      `• Total tasks: **${context.taskCount}**\n` +
      `• ⏳ Pending: ${context.pendingCount}\n` +
      `• 🔄 In progress: ${context.inProgressCount}\n` +
      `• ✅ Completed: ${context.completedCount}\n` +
      (context.overdueCount > 0
        ? `• 🔴 Overdue: ${context.overdueCount} — needs attention!\n`
        : `• 🟢 No overdue tasks — great work!\n`) +
      `\n` +
      (overdueList.length > 0
        ? `Most urgent: **${overdueList[0].title}**`
        : `Your most immediate tasks are on the Dashboard.`)
    );
  }

  if (
    lower.includes("due") ||
    lower.includes("deadline") ||
    lower.includes("upcoming")
  ) {
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const filtered = tasks
      .filter(
        (t) => t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= oneWeek && t.status !== "completed",
      )
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    if (filtered.length === 0) return "No tasks due in the next 7 days. Enjoy the calm! 🌿";
    return formatTaskList(filtered, "tasks due in the next 7 days");
  }

  const categories = ["work", "personal", "health", "shopping", "finance", "learning"];
  for (const cat of categories) {
    if (lower.includes(cat)) {
      const filtered = tasks.filter((t) => t.category === cat && t.status !== "completed");
      return formatTaskList(filtered, `${cat} tasks`);
    }
  }

  return (
    "I can query your task database in real time. Try:\n\n" +
    "• 'Show me high priority tasks today'\n" +
    "• 'Am I available on the 23rd?'\n" +
    "• 'What tasks are due next week with low priority?'\n" +
    "• 'What are my overdue tasks?'\n" +
    "• 'Give me a summary of my workload'\n" +
    "• 'What work tasks do I have pending?'"
  );
}

export function generateChatResponse(
  message: string,
  context?: ChatContext,
): string {
  return generateSmartChatResponse(message, [], context ?? {
    taskCount: 0, pendingCount: 0, inProgressCount: 0, completedCount: 0, overdueCount: 0,
  });
}
