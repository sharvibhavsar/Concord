import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Eye, EyeOff, Check, X, ShieldAlert, ArrowLeft } from "lucide-react";
import { COUNTRIES, getTimezonesForCountry, detectBrowserTimezone } from "@/lib/countries";
import { PrivacyPolicyModal } from "@/components/privacy-policy";
import { TermsModal } from "@/components/terms";

type Mode = "login" | "register" | "forgot-password" | "reset-password";
type Tab = "email" | "replit";

const USERS_STORAGE_KEY = "concord_registered_users_db";

export function LoginPage() {
  const { login, updateUser, verifyEmailToken, resendVerificationEmail } = useAuth();
  const [tab, setTab] = useState<Tab>("email");
  const [mode, setMode] = useState<Mode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset_token")) return "reset-password";
    return "login";
  });

  const resetToken = new URLSearchParams(window.location.search).get("reset_token") ?? "";
  const verifyToken = new URLSearchParams(window.location.search).get("verify_token") ?? "";

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modals state
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Registration Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Autofill timezone based on selected country
  useEffect(() => {
    if (!selectedCountry) return;
    const timezones = getTimezonesForCountry(selectedCountry);
    if (timezones.length > 0) {
      setSelectedTimezone(timezones[0]);
    } else {
      setSelectedTimezone(detectBrowserTimezone());
    }
  }, [selectedCountry]);

  // Handle URL verify_token on component mount
  useEffect(() => {
    if (verifyToken) {
      const verified = verifyEmailToken(verifyToken);
      if (verified) {
        setInfo("Your email has been successfully verified! Please log in.");
        setMode("login");
      } else {
        setError("Invalid or expired verification link (valid for 5 minutes).");
      }
    }
  }, [verifyToken, verifyEmailToken]);

  // Password validation rules check
  const passwordCriteria = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  // Calculate age from birthdate
  function calculateAge(dobString: string): number {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  function getRegisteredUsers(): Record<string, any> {
    return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) ?? "{}");
  }

  function saveRegisteredUser(userObj: any) {
    const users = getRegisteredUsers();
    users[userObj.email.toLowerCase()] = userObj;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    // Age validation (minimum 16 years of age)
    const age = calculateAge(birthdate);
    if (age < 16) {
      setError("You must be at least 16 years of age to sign up.");
      return;
    }

    // Password rules check
    if (!isPasswordValid) {
      setError("Password does not meet all security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and Confirm Password must match.");
      return;
    }

    if (!agreeTerms || !agreePrivacy) {
      setError("You must agree to both Terms & Conditions and Privacy Policy.");
      return;
    }

    // Check if email already exists
    const users = getRegisteredUsers();
    if (users[email.toLowerCase()]) {
      setError("Email Address already exists.");
      return;
    }

    setLoading(true);

    try {
      // Attempt backend registration
      try {
        const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            firstName: fullName.split(" ")[0] || fullName,
            lastName: fullName.split(" ").slice(1).join(" ") || "",
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Registration failed.");
          return;
        }
      } catch (backendErr) {
        console.warn("Backend registration offline or failed, using local storage");
      }

      const newUser = {
        id: "usr_" + Math.random().toString(36).substring(2, 11),
        email: email.trim(),
        firstName: fullName.split(" ")[0] || fullName,
        lastName: fullName.split(" ").slice(1).join(" ") || "",
        password,
        birthdate,
        country: selectedCountry,
        timezone: selectedTimezone,
        isEmailVerified: false,
        createdAt: new Date().toISOString(),
      };

      saveRegisteredUser(newUser);

      // Create session and log in user
      login(newUser, rememberSession);

      // Trigger 5-minute verification token link creation
      resendVerificationEmail();

      setInfo("Account created! A verification link valid for 5 minutes has been sent.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      // Attempt backend login
      let backendSuccess = false;
      let loggedInUser = null;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/login-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        if (res.ok) {
          const data = await res.json();
          loggedInUser = data.user;
          backendSuccess = true;
        }
      } catch (backendErr) {
        console.warn("Backend login offline or failed, using local storage");
      }

      const users = getRegisteredUsers();
      const existing = users[email.trim().toLowerCase()];

      if (!existing && !backendSuccess) {
        setError("Account not found.");
        setLoading(false);
        return;
      }

      const userToLogin = backendSuccess ? { ...existing, ...loggedInUser, isEmailVerified: true } : existing;

      if (!backendSuccess) {
        if (existing.password !== password) {
          setError("Incorrect password.");
          setLoading(false);
          return;
        }

        if (!existing.isEmailVerified) {
          setError("Please verify your email before logging in.");
          setLoading(false);
          return;
        }
      }

      login(userToLogin, rememberSession);
    } catch (err: unknown) {
      setError("Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.resetToken) {
          localStorage.setItem("concord_last_reset_token", data.resetToken);
          setInfo(`If an account exists for this email, a password reset link has been sent. Local environment link: ${window.location.origin}${window.location.pathname}?reset_token=${data.resetToken}`);
          return;
        }
      }
      setInfo("If an account exists for this email, a password reset link has been sent.");
    } catch {
      const mockToken = "mock_reset_" + Math.random().toString(36).substring(2, 12);
      localStorage.setItem("concord_last_reset_token", mockToken);
      setInfo(`If an account exists for this email, a password reset link has been sent. Local environment link: ${window.location.origin}${window.location.pathname}?reset_token=${mockToken}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!isPasswordValid) {
      setError("New password does not meet security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Reset password failed");
      }
      setInfo("Password reset successfully. You can now log in with your new password.");
      setMode("login");
    } catch (err: any) {
      const localToken = localStorage.getItem("concord_last_reset_token");
      if (localToken && resetToken === localToken) {
        const users = getRegisteredUsers();
        const firstUserEmail = Object.keys(users)[0];
        if (firstUserEmail) {
          users[firstUserEmail].password = password;
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        }
        setInfo("Password reset successfully (local environment). You can now log in with your new password.");
        setMode("login");
      } else {
        setError(err.message || "Failed to reset password. The reset link may be invalid or expired.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4 py-8 bg-background"
      style={{
        background: "linear-gradient(135deg, var(--color-background) 0%, var(--color-card) 100%)",
      }}
    >
      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />

      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-2xl shadow-lg">
            C
          </div>
          <h1 className="text-3xl font-serif font-semibold text-foreground tracking-tight">Concord</h1>
          <p className="text-muted-foreground text-sm">Your modern productivity & schedule planning platform</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl border border-border p-6 md:p-8">
          {mode === "reset-password" ? (
            <div className="space-y-4">
              <h2 className="text-xl font-serif font-semibold text-center text-foreground">Reset Password</h2>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground pr-10 text-sm focus:ring-2 focus:ring-ring"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground pr-10 text-sm focus:ring-2 focus:ring-ring"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                {info && <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{info}</p>}

                <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </div>
          ) : (
            <>
              {/* Navigation Tabs */}
              <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-xl border border-border">
                <button
                  onClick={() => { setTab("email"); setMode("login"); setError(""); setInfo(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === "email" && mode === "login" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setTab("email"); setMode("register"); setError(""); setInfo(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === "email" && mode === "register" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Create Account
                </button>
              </div>

              {/* LOGIN MODE */}
              {mode === "login" && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-foreground">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-foreground">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground pr-10 text-sm focus:ring-2 focus:ring-ring"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={rememberSession}
                        onChange={(e) => setRememberSession(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-ring"
                      />
                      Remember Session
                    </label>

                    <button
                      type="button"
                      onClick={() => { setMode("forgot-password"); setError(""); setInfo(""); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                  {info && <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{info}</p>}

                  <Button type="submit" className="w-full h-11 text-sm font-medium shadow-md" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              )}

              {/* REGISTER MODE */}
              {mode === "register" && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-foreground">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-foreground">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-foreground">
                        Birthdate <span className="text-muted-foreground">(min 16 yrs)</span>
                      </label>
                      <input
                        type="date"
                        value={birthdate}
                        onChange={(e) => setBirthdate(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-foreground">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground pr-9 text-sm focus:ring-2 focus:ring-ring"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-foreground">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground pr-9 text-sm focus:ring-2 focus:ring-ring"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password requirements criteria */}
                  {password && (
                    <div className="p-3 bg-muted/40 rounded-xl border border-border text-[11px] space-y-1">
                      <p className="font-semibold text-foreground mb-1">Password Requirements:</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <span className={passwordCriteria.minLength ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                          {passwordCriteria.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Min 8 characters
                        </span>
                        <span className={passwordCriteria.hasUpper ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                          {passwordCriteria.hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 Uppercase letter
                        </span>
                        <span className={passwordCriteria.hasLower ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                          {passwordCriteria.hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 Lowercase letter
                        </span>
                        <span className={passwordCriteria.hasNumber ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                          {passwordCriteria.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 Number
                        </span>
                        <span className={passwordCriteria.hasSpecial ? "text-emerald-600 dark:text-emerald-400 flex items-center gap-1" : "text-muted-foreground flex items-center gap-1"}>
                          {passwordCriteria.hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 Special character
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Country & Timezone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-foreground">Country</label>
                      <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                      >
                        <option value="" disabled>Select Country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-foreground">Timezone (Autofilled)</label>
                      <select
                        value={selectedTimezone}
                        onChange={(e) => setSelectedTimezone(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                      >
                        <option value="" disabled>Select Timezone</option>
                        {selectedCountry && getTimezonesForCountry(selectedCountry).map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Terms & Privacy checkboxes */}
                  <div className="space-y-2 pt-1 text-xs">
                    <label className="flex items-start gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        required
                        className="mt-0.5 rounded border-border text-primary focus:ring-ring"
                      />
                      <span>
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => setShowTerms(true)}
                          className="text-primary underline font-medium"
                        >
                          Terms & Conditions
                        </button>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={agreePrivacy}
                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                        required
                        className="mt-0.5 rounded border-border text-primary focus:ring-ring"
                      />
                      <span>
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => setShowPrivacy(true)}
                          className="text-primary underline font-medium"
                        >
                          Privacy Policy
                        </button>
                      </span>
                    </label>
                  </div>

                  {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                  {info && <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{info}</p>}

                  <Button type="submit" className="w-full h-11 text-sm font-medium shadow-md" disabled={loading}>
                    {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              )}

              {/* FORGOT PASSWORD MODE */}
              {mode === "forgot-password" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-lg font-serif font-semibold text-foreground">Forgot Password</h2>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Enter your email address below and we will send you a password reset link.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-foreground">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && <p className="text-destructive text-sm font-medium">{error}</p>}
                  {info && <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{info}</p>}

                  <Button type="submit" className="w-full h-11 text-sm font-medium shadow-md" disabled={loading}>
                    {loading ? "Sending..." : "Send Password Reset Link"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
