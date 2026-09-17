import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/contexts/profile-context";
import { useCycle } from "@/contexts/cycle-context";
import { CalendarDays } from "lucide-react";

export function PeriodUpdateDialog() {
  const { profile, updateProfile } = useProfile();
  const { cycleInfo, refetch } = useCycle();
  const [open, setOpen] = useState(false);
  const [periodDate, setPeriodDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Open when cycle says update needed and user is female with previous data
  useEffect(() => {
    if (
      cycleInfo?.needsPeriodUpdate &&
      profile?.gender === "female" &&
      profile?.lastPeriodDate &&
      !dismissed
    ) {
      setOpen(true);
    }
  }, [cycleInfo?.needsPeriodUpdate, profile?.gender, profile?.lastPeriodDate, dismissed]);

  async function handleSave() {
    if (!periodDate) return;
    setSaving(true);
    try {
      await updateProfile({ lastPeriodDate: new Date(periodDate).toISOString() });
      refetch();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-rose-500" />
          </div>
          <DialogTitle>Update your period date</DialogTitle>
          <DialogDescription>
            It's been about a month — let us know when your last period started so we can keep your schedule accurate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="new-period-date">First day of your last period</Label>
            <Input
              id="new-period-date"
              type="date"
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="h-11"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleDismiss}>
              Remind me later
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={!periodDate || saving}>
              {saving ? "Saving..." : "Update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
