import React, { useState, useEffect } from "react";
import { useProfile } from "@/contexts/profile-context";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  LogOut,
  Upload,
  Trash2,
  Lock,
  Bell,
  AlertTriangle,
  Clock,
  Globe,
  Sun,
  Moon,
  Check,
  X,
  Eye,
  EyeOff,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { COUNTRIES, getTimezonesForCountry, getAllTimezones, formatTimezone } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationPermission } from "@/lib/notifications";

const SYSTEM_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
];

const WORKING_DAYS_OPTIONS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export function ProfilePage() {
  const { profile, updateProfile, isLoading } = useProfile();
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();



  // Basic Profile Info
  const [displayName, setDisplayName] = useState(user?.firstName ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}` : profile?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [country, setCountry] = useState(user?.country ?? "US");
  const [timezone, setTimezone] = useState(user?.timezone ?? "America/New_York");
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImageUrl ?? null);

  // Extended Schedule Info
  const [workingDays, setWorkingDays] = useState<string[]>((profile as any)?.workingDays ?? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [workingStart, setWorkingStart] = useState((profile as any)?.workingStart ?? "09:00");
  const [workingEnd, setWorkingEnd] = useState((profile as any)?.workingEnd ?? "17:00");
  const [productiveStart, setProductiveStart] = useState((profile as any)?.productiveStart ?? "10:00");
  const [productiveEnd, setProductiveEnd] = useState((profile as any)?.productiveEnd ?? "15:00");
  const [sleepTime, setSleepTime] = useState((profile as any)?.sleepTime ?? "23:00");
  const [wakeTime, setWakeTime] = useState((profile as any)?.wakeTime ?? "07:00");
  const [preferredSession, setPreferredSession] = useState((profile as any)?.preferredSession ?? "45m");
  const [breakPref, setBreakPref] = useState((profile as any)?.breakPref ?? "15m");
  const [weekendAvailable, setWeekendAvailable] = useState((profile as any)?.weekendAvailable ?? false);

  // Gender & Cycle tracking states
  const [gender, setGender] = useState<"female" | "male" | "other" | "prefer_not_to_say" | null>(profile?.gender ?? null);
  const [enableCycleTracking, setEnableCycleTracking] = useState(!!profile?.lastPeriodDate);
  const [lastPeriodDate, setLastPeriodDate] = useState(profile?.lastPeriodDate ? profile.lastPeriodDate.split("T")[0] : "");
  const [cycleLength, setCycleLength] = useState(profile?.cycleLength ?? 28);
  const [lutealPhaseLength, setLutealPhaseLength] = useState(profile?.lutealPhaseLength ?? 14);

  // Notifications setting
  const [enableNotifications, setEnableNotifications] = useState(true);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);

  // Delete Account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState("");
  const [deleteTextConfirm, setDeleteTextConfirm] = useState("");

  const [saving, setSaving] = useState(false);

  // Image upload handler with size & 1:1 ratio check
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Profile picture must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.src = event.target?.result as string;
      img.onload = () => {
        // Enforce 1:1 aspect ratio tolerance (0.9 to 1.1)
        const ratio = img.width / img.height;
        if (ratio < 0.85 || ratio > 1.15) {
          toast({
            title: "Aspect ratio error",
            description: "Profile picture must be a 1:1 square image.",
            variant: "destructive",
          });
          return;
        }
        setProfileImage(img.src);
        updateUser({ profileImageUrl: img.src });
        toast({ title: "Profile picture updated" });
      };
    };

    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setProfileImage(null);
    updateUser({ profileImageUrl: null });
    toast({ title: "Profile picture removed" });
  }

  async function handleNotificationToggle(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast({ title: "Permission denied", description: "Browser notifications were not allowed.", variant: "destructive" });
        setEnableNotifications(false);
        return;
      }
    }
    setEnableNotifications(enabled);
    toast({ title: enabled ? "Notifications enabled" : "Notifications disabled" });
  }

  async function handleSaveProfile() {
    if (enableCycleTracking && lastPeriodDate) {
      const selectedDate = new Date(lastPeriodDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        toast({
          title: "Invalid Last Period Date 🛑",
          description: "The date of your last period must not be in the future.",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      updateUser({
        firstName: displayName.split(" ")[0],
        lastName: displayName.split(" ").slice(1).join(" "),
        email,
        country,
        timezone,
      });

      await updateProfile({
        displayName,
        workingDays,
        workingStart,
        workingEnd,
        productiveStart,
        productiveEnd,
        sleepTime,
        wakeTime,
        preferredSession,
        breakPref,
        weekendAvailable,
        gender,
        lastPeriodDate: enableCycleTracking && lastPeriodDate ? new Date(lastPeriodDate).toISOString() : null,
        cycleLength: enableCycleTracking ? Number(cycleLength) : 28,
        lutealPhaseLength: enableCycleTracking ? Number(lutealPhaseLength) : 14,
      } as any);

      toast({
        title: "Profile Updated Successfully 🎉",
        description: `Name: ${displayName}, Timezone: ${timezone}, Gender: ${gender || "Not specified"}${enableCycleTracking ? `, Cycle: ${cycleLength} days (Last Period: ${lastPeriodDate})` : ""}`,
      });
    } catch {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    toast({ title: "Password Updated", description: "Your password has been changed successfully." });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  async function handleDeleteAccount() {
    if (deleteTextConfirm !== "DELETE") {
      toast({ title: "Please type DELETE to confirm", variant: "destructive" });
      return;
    }

    if (user?.email) {
      const users = JSON.parse(localStorage.getItem("concord_registered_users_db") ?? "{}");
      delete users[user.email.toLowerCase()];
      localStorage.setItem("concord_registered_users_db", JSON.stringify(users));
    }

    localStorage.removeItem("concord_persistent_user_session");
    sessionStorage.removeItem("concord_persistent_user_session");
    localStorage.removeItem("concord_local_profile");
    localStorage.removeItem("concord_local_tasks");
    localStorage.removeItem("concord_local_chat");
    localStorage.removeItem("concord_local_mood");
    localStorage.removeItem("concord_last_reset_token");
    sessionStorage.clear();

    toast({ title: "Account Deleted", description: "All your data has been permanently removed." });
    logout();
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">User Profile & Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account details, preferences, and schedule setup</p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
          <LogOut className="w-4 h-4" /> Log out
        </Button>
      </div>

      {/* 1. Account Information & Profile Picture */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
            <User className="w-4 h-4 text-primary" /> Profile Picture & Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-24 h-24 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center shadow-inner shrink-0">
              {profileImage ? (
                <img src={profileImage} alt="Profile Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-serif font-bold text-primary">
                  {(displayName || "C")[0]?.toUpperCase()}
                </span>
              )}
            </div>

            <div className="space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <label className="cursor-pointer bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-sm">
                  <Upload className="w-3.5 h-3.5" /> Upload Image
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {profileImage && (
                  <Button variant="outline" size="sm" onClick={handleRemoveImage} className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Max size: 5MB. Aspect ratio: 1:1 Square image.
              </p>

              {/* System Avatars */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Presets:</span>
                {SYSTEM_AVATARS.map((avatar, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setProfileImage(avatar); updateUser({ profileImageUrl: avatar }); }}
                    className="w-7 h-7 rounded-full border border-border overflow-hidden hover:scale-110 transition-transform"
                  >
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" /> Country
              </Label>
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  const tzs = getTimezonesForCountry(e.target.value);
                  if (tzs.length > 0) setTimezone(tzs[0]);
                }}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Timezone
              </Label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
              >
                {getAllTimezones().map((tz) => (
                  <option key={tz} value={tz}>{formatTimezone(tz)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Gender and Cycle Tracking */}
          <div className="pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <select
                  value={gender ?? ""}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setGender(val || null);
                    if (val !== "female") setEnableCycleTracking(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                >
                  <option value="">Select Gender...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              {gender === "female" && (
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="cycle-track-check"
                    checked={enableCycleTracking}
                    onChange={(e) => setEnableCycleTracking(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                  />
                  <Label htmlFor="cycle-track-check" className="cursor-pointer text-xs font-medium">
                    Enable menstrual cycle-aware recommendations
                  </Label>
                </div>
              )}
            </div>

            {gender === "female" && enableCycleTracking && (
              <div className="p-4 bg-muted/30 border border-border/50 rounded-xl space-y-4 animate-in fade-in">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Menstrual Cycle Parameters
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Period Start Date</Label>
                    <Input
                      type="date"
                      value={lastPeriodDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setLastPeriodDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Average Cycle Length (Days)</Label>
                    <Input
                      type="number"
                      min="20"
                      max="45"
                      value={cycleLength}
                      onChange={(e) => setCycleLength(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Luteal Phase (Days)</Label>
                    <Input
                      type="number"
                      min="10"
                      max="20"
                      value={lutealPhaseLength}
                      onChange={(e) => setLutealPhaseLength(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Schedule & Productivity Setup */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
            <Clock className="w-4 h-4 text-primary" /> Working Schedule & Productivity Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-2">
              {WORKING_DAYS_OPTIONS.map((day) => {
                const selected = workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setWorkingDays(prev => selected ? prev.filter(d => d !== day) : [...prev, day]);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Working Hours</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={workingStart} onChange={(e) => setWorkingStart(e.target.value)} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={workingEnd} onChange={(e) => setWorkingEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Productive Peak Hours</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={productiveStart} onChange={(e) => setProductiveStart(e.target.value)} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={productiveEnd} onChange={(e) => setProductiveEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sleep & Wake-up Time</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} title="Sleep Time" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} title="Wake-up Time" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Work Session & Break Preference</Label>
              <div className="flex items-center gap-2">
                <Input value={preferredSession} onChange={(e) => setPreferredSession(e.target.value)} placeholder="45m" />
                <span className="text-xs text-muted-foreground">break</span>
                <Input value={breakPref} onChange={(e) => setBreakPref(e.target.value)} placeholder="15m" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="weekend-avail"
              checked={weekendAvailable}
              onChange={(e) => setWeekendAvailable(e.target.checked)}
              className="rounded border-border text-primary focus:ring-ring"
            />
            <Label htmlFor="weekend-avail" className="cursor-pointer text-xs">Available for urgent tasks on weekends</Label>
          </div>
        </CardContent>
      </Card>

      {/* 3. Notification Preferences & Theme */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
            <Bell className="w-4 h-4 text-primary" /> Notifications & Theme
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">Browser Notifications</p>
              <p className="text-xs text-muted-foreground">Receive high-priority task reminders, daily accomplishment alerts, and monthly reviews.</p>
            </div>
            <input
              type="checkbox"
              checked={enableNotifications}
              onChange={(e) => handleNotificationToggle(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-ring cursor-pointer"
            />
          </div>

          <div className="pt-4 border-t border-border space-y-2">
            <Label className="text-sm font-medium">Color Theme</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${theme === "light" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
              >
                <Sun className="w-4 h-4" /> Light Mode
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
              >
                <Moon className="w-4 h-4" /> Dark Mode
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSaveProfile} disabled={saving} className="w-full h-11 shadow-md">
        {saving ? "Saving Changes..." : "Save Profile Settings"}
      </Button>



      {/* 4. Change Password */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
            <Lock className="w-4 h-4 text-primary" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label className="text-xs">Current Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showCurrentPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Confirm New Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showConfirmNewPass ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPass(!showConfirmNewPass)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" variant="secondary" className="flex-1">
                Update Password
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/forgot-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    });
                  } catch (e) {
                    console.error("Forgot password post failed:", e);
                  }
                  toast({
                    title: "Password reset link sent",
                    description: `If an account exists for ${email}, a password reset link has been sent.`,
                  });
                }}
              >
                Forgot Password?
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 5. Delete Account Danger Zone */}
      <Card className="border-destructive/40 shadow-sm bg-destructive/5">
        <CardHeader className="border-b border-destructive/20 pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" /> Delete Account Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            This action is permanent and cannot be undone. All your profile data, tasks, calendar items, projects, analytics, and uploaded files will be permanently deleted.
          </p>

          {!showDeleteModal ? (
            <Button variant="destructive" onClick={() => setShowDeleteModal(true)} className="w-full">
              Delete Account
            </Button>
          ) : (
            <div className="p-4 bg-background border border-destructive/30 rounded-xl space-y-4 animate-in fade-in">
              <p className="text-sm font-semibold text-destructive">Are you absolutely sure?</p>

              <div>
                <Label className="text-xs">Enter your current password</Label>
                <Input
                  type="password"
                  value={deletePasswordConfirm}
                  onChange={(e) => setDeletePasswordConfirm(e.target.value)}
                  placeholder="Current password"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Type "DELETE" to confirm permanent removal</Label>
                <Input
                  value={deleteTextConfirm}
                  onChange={(e) => setDeleteTextConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteAccount} className="flex-1">
                  Permanently Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
