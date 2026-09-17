import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  isEmailVerified?: boolean;
  birthdate?: string;
  country?: string;
  timezone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: AuthUser, remember?: boolean) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  verifyEmailToken: (token: string) => boolean;
  verifyUserDirectly: () => void;
  resendVerificationEmail: () => string;
  changeEmailAddress: (newEmail: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = "concord_persistent_user_session";
const VERIF_STORAGE_KEY = "concord_verification_tokens";
const USERS_DB_KEY = "concord_registered_users_db";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync registered user database entry
  const syncUserToDb = useCallback((updatedUser: AuthUser) => {
    try {
      const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) ?? "{}");
      if (updatedUser.email) {
        users[updatedUser.email.toLowerCase()] = {
          ...users[updatedUser.email.toLowerCase()],
          ...updatedUser,
        };
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
      }
    } catch (err) {
      console.error("Failed to sync user DB:", err);
    }
  }, []);

  // Restore session from sessionStorage on app load
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored);
        setUser(parsed);
        // Ensure it persists in sessionStorage
        sessionStorage.setItem(AUTH_STORAGE_KEY, stored);
      }
    } catch (err) {
      console.error("Failed to restore auth session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);


  const login = useCallback((userData: AuthUser, _remember: boolean = true) => {
    setUser(userData);
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    syncUserToDb(userData);
  }, [syncUserToDb]);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.clear();
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      syncUserToDb(updated);
      return updated;
    });
  }, [syncUserToDb]);

  const resendVerificationEmail = useCallback((): string => {
    if (!user) return "";
    const tokens: Record<string, { email: string; expiresAt: number }> = JSON.parse(
      localStorage.getItem(VERIF_STORAGE_KEY) ?? "{}"
    );

    const newToken = "vtoken_" + Math.random().toString(36).substring(2, 12);
    // 5 minutes validity
    const expiresAt = Date.now() + 5 * 60 * 1000;
    tokens[newToken] = { email: user.email, expiresAt };
    localStorage.setItem(VERIF_STORAGE_KEY, JSON.stringify(tokens));

    const verifUrl = `${window.location.origin}${window.location.pathname}?verify_token=${newToken}`;
    console.log(`[Verification Email Sent to ${user.email}] Link valid for 5 mins: ${verifUrl}`);
    return verifUrl;
  }, [user]);

  const verifyEmailToken = useCallback((token: string): boolean => {
    try {
      const tokens: Record<string, { email: string; expiresAt: number }> = JSON.parse(
        localStorage.getItem(VERIF_STORAGE_KEY) ?? "{}"
      );
      const record = tokens[token];
      if (record && record.expiresAt > Date.now()) {
        delete tokens[token];
        localStorage.setItem(VERIF_STORAGE_KEY, JSON.stringify(tokens));
        if (user && user.email.toLowerCase() === record.email.toLowerCase()) {
          updateUser({ isEmailVerified: true });
        }
        return true;
      }
    } catch (err) {
      console.error("Verification failed:", err);
    }
    return false;
  }, [user, updateUser]);

  const verifyUserDirectly = useCallback(() => {
    if (user) {
      updateUser({ isEmailVerified: true });
    }
  }, [user, updateUser]);

  const changeEmailAddress = useCallback((newEmail: string) => {
    if (!user) return;
    updateUser({ email: newEmail, isEmailVerified: false });
    resendVerificationEmail();
  }, [user, updateUser, resendVerificationEmail]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
        verifyEmailToken,
        verifyUserDirectly,
        resendVerificationEmail,
        changeEmailAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
