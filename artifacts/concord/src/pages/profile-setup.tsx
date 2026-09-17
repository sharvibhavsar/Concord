import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/contexts/profile-context";
import { useAuth } from "@/contexts/auth-context";
import { User, Heart, Calendar, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "name" | "gender" | "period";

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Non-binary / Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export function ProfileSetup() {
  const { user } = useAuth();
  const { updateProfile } = useProfile();

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(
    user?.firstName ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}` : "",
  );
  const [gender, setGender] = useState<string>("");
  const [periodDate, setPeriodDate] = useState("");
  const [cycleLength, setCycleLength] = useState("28");
  const [saving, setSaving] = useState(false);

  async function handleNameNext() {
    if (!name.trim()) return;
    setStep("gender");
  }

  async function handleGenderNext() {
    if (!gender) return;
    if (gender === "female") {
      setStep("period");
    } else {
      await save(gender, null, null);
    }
  }

  async function handlePeriodNext() {
    if (periodDate) {
      const selectedDate = new Date(periodDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        alert("The date of your last period must not be in the future.");
        return;
      }
    }
    await save(gender, periodDate || null, Number(cycleLength) || 28);
  }

  async function save(
    selectedGender: string,
    lastPeriodDate: string | null,
    cycleLengthDays: number | null,
  ) {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        displayName: name.trim(),
        gender: selectedGender,
      };
      if (lastPeriodDate) {
        updates.lastPeriodDate = new Date(lastPeriodDate).toISOString();
      }
      if (cycleLengthDays) {
        updates.cycleLength = cycleLengthDays;
      }
      await updateProfile(updates);
    } finally {
      setSaving(false);
    }
  }

  const steps = ["name", "gender", ...(gender === "female" ? ["period"] : [])] as Step[];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-2xl shadow-lg mx-auto mb-4">
            C
          </div>
          <h1 className="text-2xl font-serif font-medium">Welcome to Concord</h1>
          <p className="text-muted-foreground mt-1">Let's personalise your experience</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === currentIdx ? "w-8 bg-primary" : i < currentIdx ? "w-4 bg-primary/40" : "w-4 bg-border",
              )}
            />
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === "name" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">What should we call you?</h2>
                  <p className="text-sm text-muted-foreground">This appears on your dashboard</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aisha"
                  className="h-12 text-base"
                  onKeyDown={(e) => e.key === "Enter" && handleNameNext()}
                  autoFocus
                />
              </div>
              <Button
                className="w-full h-11"
                onClick={handleNameNext}
                disabled={!name.trim()}
              >
                Continue <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {step === "gender" && (
            <motion.div
              key="gender"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Your gender</h2>
                  <p className="text-sm text-muted-foreground">Enables cycle-aware task scheduling</p>
                </div>
              </div>
              <div className="grid gap-2">
                {GENDERS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setGender(value)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 text-sm font-medium",
                      gender === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-border/80 hover:bg-muted/50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button
                className="w-full h-11"
                onClick={handleGenderNext}
                disabled={!gender || saving}
              >
                {saving ? "Saving..." : gender === "female" ? (
                  <>Continue <ChevronRight className="ml-1 w-4 h-4" /></>
                ) : "Finish setup"}
              </Button>
            </motion.div>
          )}

          {step === "period" && (
            <motion.div
              key="period"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Period tracking</h2>
                  <p className="text-sm text-muted-foreground">We'll adjust your task load each phase</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How it works</p>
                <p>During your <span className="text-rose-500 font-medium">menstrual</span> and <span className="text-amber-500 font-medium">luteal</span> phases, we'll suggest rescheduling low-priority tasks so you can focus on recovery and essential work.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="period-date">First day of your last period</Label>
                  <Input
                    id="period-date"
                    type="date"
                    value={periodDate}
                    onChange={(e) => setPeriodDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycle-length">Average cycle length (days)</Label>
                  <Input
                    id="cycle-length"
                    type="number"
                    min={21}
                    max={45}
                    value={cycleLength}
                    onChange={(e) => setCycleLength(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => save(gender, null, null)}
                  disabled={saving}
                >
                  Skip for now
                </Button>
                <Button
                  className="flex-1 h-11"
                  onClick={handlePeriodNext}
                  disabled={saving}
                >
                  {saving ? "Saving..." : (
                    <><Sparkles className="mr-1 w-4 h-4" /> Finish setup</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
