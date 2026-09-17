import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, MessageSquare, Plus, Home, CalendarDays, BarChart3, Sun, Moon, AlertTriangle, RefreshCw, Mail, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useProfile } from "@/contexts/profile-context";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, resendVerificationEmail, changeEmailAddress, verifyUserDirectly } = useAuth();
  const { profile } = useProfile();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [activeVerifUrl, setActiveVerifUrl] = useState<string | null>(null);

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/tasks", label: "Tasks", icon: CheckCircle2 },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/add", label: "Add Task", icon: Plus },
    { href: "/chat", label: "Assistant", icon: MessageSquare },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const mobileNavItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/tasks", label: "Tasks", icon: CheckCircle2 },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/add", label: "Add Task", icon: Plus },
    { href: "/chat", label: "Assistant", icon: MessageSquare },
  ];

  const displayName =
    profile?.displayName ??
    (user?.firstName ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}` : null) ??
    "Account";

  const initials = displayName[0]?.toUpperCase() ?? "C";

  function handleResend() {
    const linkUrl = resendVerificationEmail();
    setActiveVerifUrl(linkUrl);
    toast({
      title: "Verification Email Sent",
      description: "Verification link generated (valid for 5 minutes).",
    });
  }

  function handleDirectVerify() {
    verifyUserDirectly();
    setActiveVerifUrl(null);
    toast({
      title: "Email Verified! 🎉",
      description: "Your email has been verified. We suggest completing your profile setup.",
    });
  }

  function handleChangeEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailInput)) {
      toast({ title: "Invalid email format", variant: "destructive" });
      return;
    }
    changeEmailAddress(newEmailInput.trim());
    setShowChangeEmail(false);
    setNewEmailInput("");
    toast({ title: "Email Updated", description: "New 5-minute verification link sent." });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Verification Link Dialog Preview */}
      {activeVerifUrl && (
        <Dialog open={!!activeVerifUrl} onOpenChange={() => setActiveVerifUrl(null)}>
          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary">
                <Mail className="w-5 h-5" />
                <DialogTitle className="text-lg font-serif">Verification Email Link Sent</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Your email verification link is active for <strong>5 minutes</strong>. Click below to verify instantly:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded-xl border border-border text-xs break-all text-foreground font-mono">
                {activeVerifUrl}
              </div>

              <div className="flex gap-2">
                <Button variant="default" className="flex-1 text-xs gap-1.5" onClick={handleDirectVerify}>
                  <Check className="w-4 h-4" /> Verify Email Now
                </Button>
                <a href={activeVerifUrl} target="_self" className="flex-1">
                  <Button variant="outline" className="w-full text-xs gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Open Link
                  </Button>
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Top Banner for Unverified Email */}
      {user && !user.isEmailVerified && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Please verify your email to continue.</span>
            </div>

            {!showChangeEmail ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="default" onClick={handleDirectVerify} className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1">
                  <Check className="w-3.5 h-3.5" /> Verify Email Now
                </Button>
                <Button size="sm" variant="outline" onClick={handleResend} className="h-7 text-xs bg-background gap-1">
                  <RefreshCw className="w-3 h-3" /> Resend email link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowChangeEmail(true)} className="h-7 text-xs gap-1">
                  <Mail className="w-3 h-3" /> Change email address
                </Button>
              </div>
            ) : (
              <form onSubmit={handleChangeEmailSubmit} className="flex items-center gap-2">
                <Input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="New email address"
                  className="h-7 text-xs w-48 bg-background"
                />
                <Button type="submit" size="sm" className="h-7 text-xs">Save</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowChangeEmail(false)} className="h-7 text-xs">Cancel</Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Main Top Header Navbar */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group transition-transform hover:scale-105 active:scale-95">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-lg shadow-sm">
                C
              </div>
              <span className="font-serif font-semibold text-xl tracking-tight text-foreground">Concord</span>
            </Link>

            {/* Desktop Navigation Links — Add Task and Assistant in one line with standard nav CSS */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* User Avatar & Link */}
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors overflow-hidden">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-primary">{initials}</span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <nav className="flex items-center justify-around p-2">
          {mobileNavItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[3.5rem]",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-10 mb-16 md:mb-0">
        {children}
      </main>
    </div>
  );
}
